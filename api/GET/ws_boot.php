<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$port = 8085;
$probe = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.12);
if ($probe) {
    @fclose($probe);
    echo json_encode([
        'running' => true,
        'started' => false,
        'port' => $port
    ]);
    exit;
}

$serverScript = realpath(__DIR__ . '/../ws_server.php');
$phpCandidates = [
    'C:\\xampp\\php\\php.exe',
    PHP_BINDIR . DIRECTORY_SEPARATOR . 'php.exe',
    'php'
];

$phpBin = 'php';
foreach ($phpCandidates as $candidate) {
    if ($candidate !== 'php' && file_exists($candidate)) {
        $phpBin = $candidate;
        break;
    }
}

if ($serverScript && stripos(PHP_OS, 'WIN') === 0) {
    $cmd = 'start /B "" "' . $phpBin . '" "' . $serverScript . '" ' . $port . ' > NUL 2>&1';
    @pclose(@popen($cmd, 'r'));
} elseif ($serverScript) {
    $cmd = escapeshellarg($phpBin) . ' ' . escapeshellarg($serverScript) . ' ' . intval($port) . ' > /dev/null 2>&1 &';
    @exec($cmd);
}

$running = false;
for ($i = 0; $i < 5; $i++) {
    usleep(80000);
    $chk = @fsockopen('127.0.0.1', $port, $e1, $e2, 0.1);
    if ($chk) {
        @fclose($chk);
        $running = true;
        break;
    }
}

echo json_encode([
    'running' => $running,
    'started' => $running,
    'port' => $port
]);
?>
