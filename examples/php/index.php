<?php
require_once __DIR__ . '/AgentContent.php';

$agent = new AgentContent(__DIR__ . '/markdown');

// Intercept AI agent requests and serve Markdown
$agent->handle();

// Standard HTML Website for human web browsers
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PHP Website with AgentContent</title>
</head>
<body style="font-family: sans-serif; padding: 2rem;">
    <h1>Welcome to PHP Website (HTML Browser View)</h1>
    <p>Human browsers see this HTML content.</p>
    <p>AI agents sending <code>Accept: text/markdown</code> receive clean Markdown directly from PHP.</p>
    <ul>
        <li><a href="/about.php">About page</a></li>
        <li><a href="/about.php?format=md">Markdown via query</a></li>
        <li><a href="/llms.txt">Discovery llms.txt</a></li>
    </ul>
</body>
</html>

