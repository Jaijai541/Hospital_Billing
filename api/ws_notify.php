<?php
function broadcastWebSocketEvent(string $topic, string $action, array $extra = []): bool
{
    $port = 8085;
    $sock = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.08);
    if (!$sock) {
        return false;
    }

    stream_set_timeout($sock, 0, 120000);

    $payload = array_merge([
        'type' => 'realtime_event',
        'topic' => $topic,
        'action' => $action,
        'timestamp' => date('Y-m-d H:i:s')
    ], $extra);

    $body = json_encode($payload);
    if ($body === false) {
        @fclose($sock);
        return false;
    }

    $req = "POST /publish HTTP/1.1\r\n"
        . "Host: 127.0.0.1:{$port}\r\n"
        . "Content-Type: application/json\r\n"
        . "Content-Length: " . strlen($body) . "\r\n"
        . "Connection: close\r\n\r\n"
        . $body;

    @fwrite($sock, $req);
    @fread($sock, 256);
    @fclose($sock);
    return true;
}
?>
