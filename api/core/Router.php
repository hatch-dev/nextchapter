<?php
namespace Core;

/**
 * Minimal HTTP router.
 *
 * Routes are registered as (METHOD, path) => [ControllerClass, 'method'].
 * Add new endpoints in routes/api.php — no change to this class needed.
 */
class Router
{
    /** @var array<string, array{0:string,1:string}> keyed by "METHOD path" */
    private array $routes = [];

    private string $basePath;

    public function __construct(string $basePath = '')
    {
        $this->basePath = rtrim($basePath, '/');
    }

    public function get(string $path, array $handler): void  { $this->add('GET', $path, $handler); }
    public function post(string $path, array $handler): void { $this->add('POST', $path, $handler); }
    public function put(string $path, array $handler): void  { $this->add('PUT', $path, $handler); }
    public function delete(string $path, array $handler): void { $this->add('DELETE', $path, $handler); }

    private function add(string $method, string $path, array $handler): void
    {
        $this->routes[$method . ' ' . $this->normalize($path)] = $handler;
    }

    /** Dispatch the current request to its handler, or 404 / 405. */
    public function dispatch(string $method, string $uri): void
    {
        $path = $this->normalize($this->stripBasePath(parse_url($uri, PHP_URL_PATH) ?? '/'));
        $key  = $method . ' ' . $path;

        if (isset($this->routes[$key])) {
            [$class, $action] = $this->routes[$key];
            (new $class())->{$action}();
            return;
        }

        // Path exists but method doesn't -> 405; otherwise 404.
        foreach ($this->routes as $registered => $_) {
            if (substr($registered, strpos($registered, ' ') + 1) === $path) {
                Response::error('Method not allowed.', 405);
            }
        }
        Response::error('Endpoint not found.', 404);
    }

    private function stripBasePath(string $path): string
    {
        if ($this->basePath !== '' && strpos($path, $this->basePath) === 0) {
            $path = substr($path, strlen($this->basePath));
        }
        return $path === '' ? '/' : $path;
    }

    private function normalize(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '/' ? '/' : rtrim($path, '/');
    }
}
