<?php
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json');
    http_response_code(403);
    echo json_encode(['error' => 'WebSocket server must run in CLI mode.']);
    exit(1);
}

set_time_limit(0);
error_reporting(E_ALL);

$port = intval($argv[1] ?? 8085);
$bindAddress = "tcp://0.0.0.0:{$port}";

$server = @stream_socket_server($bindAddress, $errno, $errstr);
if (!$server) {
    fwrite(STDERR, "WebSocket port {$port} already active or unavailable: {$errstr}\n");
    exit(0);
}

stream_set_blocking($server, false);
fwrite(STDOUT, "[" . date('Y-m-d H:i:s') . "] Hospital Billing WebSocket Server listening on port {$port}\n");

function encodeWsFrame(string $payload, int $opcode = 0x1): string
{
    $firstByte = 0x80 | ($opcode & 0x0F);
    $len = strlen($payload);
    if ($len <= 125) {
        return pack('CC', $firstByte, $len) . $payload;
    }
    if ($len <= 65535) {
        return pack('CCn', $firstByte, 126, $len) . $payload;
    }
    return pack('CCNN', $firstByte, 127, 0, $len) . $payload;
}

function sendWsRaw($sock, string $frame): bool
{
    $total = strlen($frame);
    $written = 0;
    while ($written < $total) {
        $n = @fwrite($sock, substr($frame, $written));
        if ($n === false || $n === 0) {
            return false;
        }
        $written += $n;
    }
    return true;
}

function parseHttpHeaders(string $rawHeader): array
{
    $lines = explode("\r\n", $rawHeader);
    $requestLine = array_shift($lines) ?: '';
    $parts = explode(' ', $requestLine, 3);
    $method = strtoupper(trim($parts[0] ?? 'GET'));
    $uri = trim($parts[1] ?? '/');
    $headers = [];
    foreach ($lines as $line) {
        $pos = strpos($line, ':');
        if ($pos !== false) {
            $k = strtolower(trim(substr($line, 0, $pos)));
            $v = trim(substr($line, $pos + 1));
            $headers[$k] = $v;
        }
    }
    return [$method, $uri, $headers];
}

function disconnectClient(array &$clients, int $id): void
{
    if (!isset($clients[$id])) {
        return;
    }
    if (is_resource($clients[$id]['socket'])) {
        @fclose($clients[$id]['socket']);
    }
    unset($clients[$id]);
}

function broadcastEventToClients(array &$clients, array $eventPayload): int
{
    $encodedJson = json_encode($eventPayload);
    if ($encodedJson === false) {
        return 0;
    }
    $frame = encodeWsFrame($encodedJson, 0x1);
    $sentCount = 0;
    $deadIds = [];

    foreach ($clients as $cid => $client) {
        if (empty($client['handshaked'])) {
            continue;
        }
        if (!empty($eventPayload['target_user_only']) && intval($client['user_id']) !== intval($eventPayload['target_user_only'])) {
            continue;
        }
        if (sendWsRaw($client['socket'], $frame)) {
            $sentCount++;
        } else {
            $deadIds[] = $cid;
        }
    }

    foreach ($deadIds as $did) {
        disconnectClient($clients, $did);
    }

    return $sentCount;
}

$clients = [];
$lastPingAt = time();

while (true) {
    $read = [$server];
    foreach ($clients as $c) {
        if (is_resource($c['socket'])) {
            $read[] = $c['socket'];
        }
    }
    $write = null;
    $except = null;

    $changed = @stream_select($read, $write, $except, 1, 0);
    if ($changed === false) {
        continue;
    }

    if (in_array($server, $read, true)) {
        $newSock = @stream_socket_accept($server, 0, $peerName);
        if ($newSock) {
            stream_set_blocking($newSock, false);
            $cid = (int) $newSock;
            $clients[$cid] = [
                'socket' => $newSock,
                'peer' => (string) $peerName,
                'handshaked' => false,
                'buffer' => '',
                'user_id' => 0,
                'role_id' => 0,
                'station_ids' => [],
                'admission_id' => 0,
                'connected_at' => time(),
                'last_seen' => time()
            ];
        }
        $serverKey = array_search($server, $read, true);
        if ($serverKey !== false) {
            unset($read[$serverKey]);
        }
    }

    foreach ($read as $sock) {
        $cid = (int) $sock;
        if (!isset($clients[$cid])) {
            continue;
        }

        $chunk = @fread($sock, 16384);
        if ($chunk === '' || $chunk === false) {
            if (@feof($sock) || $chunk === false) {
                disconnectClient($clients, $cid);
            }
            continue;
        }

        $clients[$cid]['buffer'] .= $chunk;
        $clients[$cid]['last_seen'] = time();

        if (!$clients[$cid]['handshaked']) {
            $hdrEnd = strpos($clients[$cid]['buffer'], "\r\n\r\n");
            if ($hdrEnd === false) {
                if (strlen($clients[$cid]['buffer']) > 16384) {
                    disconnectClient($clients, $cid);
                }
                continue;
            }

            $rawHeader = substr($clients[$cid]['buffer'], 0, $hdrEnd);
            $remaining = substr($clients[$cid]['buffer'], $hdrEnd + 4);
            [$method, $uri, $headers] = parseHttpHeaders($rawHeader);

            $upgradeHdr = strtolower($headers['upgrade'] ?? '');
            $wsKey = $headers['sec-websocket-key'] ?? '';

            if ($upgradeHdr === 'websocket' && $wsKey !== '') {
                $acceptKey = base64_encode(sha1($wsKey . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));
                $handshakeResp = "HTTP/1.1 101 Switching Protocols\r\n"
                    . "Upgrade: websocket\r\n"
                    . "Connection: Upgrade\r\n"
                    . "Sec-WebSocket-Accept: {$acceptKey}\r\n\r\n";

                if (!sendWsRaw($sock, $handshakeResp)) {
                    disconnectClient($clients, $cid);
                    continue;
                }

                $clients[$cid]['handshaked'] = true;
                $clients[$cid]['buffer'] = $remaining;

                $welcome = encodeWsFrame(json_encode([
                    'type' => 'connected',
                    'server_time' => date('Y-m-d H:i:s')
                ]));
                sendWsRaw($sock, $welcome);
            } elseif ($method === 'POST' && strpos($uri, '/publish') === 0) {
                $contentLen = intval($headers['content-length'] ?? 0);
                if (strlen($remaining) < $contentLen) {
                    continue;
                }

                $peerIp = $clients[$cid]['peer'];
                $isLocalPeer = (strpos($peerIp, '127.0.0.1') === 0 || strpos($peerIp, '[::1]') === 0 || strpos($peerIp, '::1') === 0);

                if (!$isLocalPeer) {
                    $forbiddenBody = json_encode(['error' => 'Forbidden']);
                    $resp = "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: " . strlen($forbiddenBody) . "\r\nConnection: close\r\n\r\n" . $forbiddenBody;
                    sendWsRaw($sock, $resp);
                    disconnectClient($clients, $cid);
                    continue;
                }

                $jsonBody = substr($remaining, 0, $contentLen);
                $decoded = json_decode($jsonBody, true);
                $delivered = 0;
                if (is_array($decoded)) {
                    $delivered = broadcastEventToClients($clients, $decoded);
                    $topicStr = $decoded['topic'] ?? 'system';
                    $actStr = $decoded['action'] ?? 'update';
                    fwrite(STDOUT, "[" . date('H:i:s') . "] Broadcast {$topicStr}:{$actStr} -> {$delivered} client(s)\n");
                }

                $okBody = json_encode(['success' => true, 'delivered' => $delivered]);
                $httpResp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " . strlen($okBody) . "\r\nConnection: close\r\n\r\n" . $okBody;
                sendWsRaw($sock, $httpResp);
                disconnectClient($clients, $cid);
                continue;
            } else {
                $wsCount = 0;
                foreach ($clients as $cl) {
                    if (!empty($cl['handshaked'])) {
                        $wsCount++;
                    }
                }
                $healthBody = json_encode(['status' => 'running', 'port' => $port, 'clients' => $wsCount]);
                $httpResp = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: " . strlen($healthBody) . "\r\nConnection: close\r\n\r\n" . $healthBody;
                sendWsRaw($sock, $httpResp);
                disconnectClient($clients, $cid);
                continue;
            }
        }

        while (isset($clients[$cid]) && $clients[$cid]['handshaked'] && strlen($clients[$cid]['buffer']) >= 2) {
            $buf = $clients[$cid]['buffer'];
            $b0 = ord($buf[0]);
            $b1 = ord($buf[1]);
            $opcode = $b0 & 0x0F;
            $isMasked = ($b1 & 0x80) !== 0;
            $payloadLen = $b1 & 0x7F;
            $offset = 2;

            if ($payloadLen === 126) {
                if (strlen($buf) < 4) {
                    break;
                }
                $unpacked = unpack('nlen', substr($buf, 2, 2));
                $payloadLen = $unpacked['len'];
                $offset = 4;
            } elseif ($payloadLen === 127) {
                if (strlen($buf) < 10) {
                    break;
                }
                $unpacked = unpack('Nhigh/Nlow', substr($buf, 2, 8));
                $payloadLen = ($unpacked['high'] << 32) | $unpacked['low'];
                $offset = 10;
            }

            $maskBytes = $isMasked ? 4 : 0;
            $totalFrameSize = $offset + $maskBytes + $payloadLen;
            if (strlen($buf) < $totalFrameSize) {
                break;
            }

            $maskKey = $isMasked ? substr($buf, $offset, 4) : '';
            $rawPayload = substr($buf, $offset + $maskBytes, $payloadLen);
            $clients[$cid]['buffer'] = substr($buf, $totalFrameSize);

            if ($isMasked && $payloadLen > 0) {
                $unmasked = '';
                for ($i = 0; $i < $payloadLen; $i++) {
                    $unmasked .= $rawPayload[$i] ^ $maskKey[$i % 4];
                }
                $rawPayload = $unmasked;
            }

            if ($opcode === 0x8) {
                sendWsRaw($sock, encodeWsFrame('', 0x8));
                disconnectClient($clients, $cid);
                break;
            } elseif ($opcode === 0x9) {
                sendWsRaw($sock, encodeWsFrame($rawPayload, 0xA));
            } elseif ($opcode === 0x1) {
                $msg = json_decode($rawPayload, true);
                if (is_array($msg)) {
                    $msgType = $msg['type'] ?? '';
                    if ($msgType === 'subscribe' || $msgType === 'auth') {
                        $clients[$cid]['user_id'] = intval($msg['user_id'] ?? 0);
                        $clients[$cid]['role_id'] = intval($msg['role_id'] ?? 0);
                        $clients[$cid]['admission_id'] = intval($msg['admission_id'] ?? 0);
                        if (!empty($msg['station_ids']) && is_array($msg['station_ids'])) {
                            $clients[$cid]['station_ids'] = array_map('intval', $msg['station_ids']);
                        }
                        sendWsRaw($sock, encodeWsFrame(json_encode([
                            'type' => 'subscribed',
                            'user_id' => $clients[$cid]['user_id'],
                            'admission_id' => $clients[$cid]['admission_id']
                        ])));
                    } elseif ($msgType === 'ping') {
                        sendWsRaw($sock, encodeWsFrame(json_encode([
                            'type' => 'pong',
                            'ts' => time()
                        ])));
                    }
                }
            }
        }
    }

    $now = time();
    if ($now - $lastPingAt >= 25) {
        $lastPingAt = $now;
        $pingFrame = encodeWsFrame('hb', 0x9);
        $staleIds = [];
        foreach ($clients as $cid => $c) {
            if (!$c['handshaked']) {
                if ($now - $c['connected_at'] > 10) {
                    $staleIds[] = $cid;
                }
                continue;
            }
            if (!sendWsRaw($c['socket'], $pingFrame)) {
                $staleIds[] = $cid;
            }
        }
        foreach ($staleIds as $sid) {
            disconnectClient($clients, $sid);
        }
    }
}
?>
