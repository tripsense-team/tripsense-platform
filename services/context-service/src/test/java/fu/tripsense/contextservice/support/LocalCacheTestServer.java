package fu.tripsense.contextservice.support;

import java.io.IOException;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Explicitly opt-in disposable processes. Never connects to an existing Redis or PostgreSQL. */
public final class LocalCacheTestServer implements AutoCloseable {
  public final int port;
  public final Path directory;
  private Process process;
  private final List<String> start;

  private LocalCacheTestServer(boolean postgres) throws Exception {
    directory = Files.createTempDirectory(Path.of("/tmp"), "tripsense-context-it-");
    try (var socket = new java.net.ServerSocket(0, 0, InetAddress.getLoopbackAddress())) {
      port = socket.getLocalPort();
    }
    if (postgres) {
      String bin = System.getProperty("context.test.pg.bin", "/opt/homebrew/opt/postgresql@18/bin");
      run(
          List.of(
              bin + "/initdb",
              "-D",
              directory.resolve("data").toString(),
              "-A",
              "trust",
              "-U",
              "cache_test",
              "--no-locale",
              "-E",
              "UTF8"));
      start =
          List.of(
              bin + "/postgres",
              "-D",
              directory.resolve("data").toString(),
              "-h",
              "127.0.0.1",
              "-p",
              Integer.toString(port),
              "-k",
              directory.toString());
    } else {
      start =
          List.of(
              System.getProperty("context.test.redis.bin", "/opt/homebrew/bin/redis-server"),
              "--bind",
              "127.0.0.1",
              "--port",
              Integer.toString(port),
              "--dir",
              directory.toString(),
              "--save",
              "",
              "--appendonly",
              "no",
              "--maxmemory",
              "8mb",
              "--maxmemory-policy",
              "allkeys-lfu");
    }
    restart();
  }

  public static LocalCacheTestServer redis() throws Exception {
    return new LocalCacheTestServer(false);
  }

  public static LocalCacheTestServer postgres() throws Exception {
    return new LocalCacheTestServer(true);
  }

  public void restart() throws Exception {
    process =
        new ProcessBuilder(start)
            .redirectErrorStream(true)
            .redirectOutput(
                ProcessBuilder.Redirect.appendTo(directory.resolve("server.log").toFile()))
            .start();
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while (System.nanoTime() < deadline) {
      if (!process.isAlive())
        throw new IOException("Temporary server exited: " + directory.resolve("server.log"));
      try (var socket = new Socket()) {
        socket.connect(new InetSocketAddress("127.0.0.1", port), 100);
        return;
      } catch (IOException retry) {
        Thread.sleep(20);
      }
    }
    throw new IOException("Temporary server startup timed out: " + directory.resolve("server.log"));
  }

  public void stop() throws Exception {
    if (process != null) {
      process.destroy();
      if (!process.waitFor(10, TimeUnit.SECONDS)) {
        process.destroyForcibly();
        process.waitFor(2, TimeUnit.SECONDS);
      }
    }
  }

  private void run(List<String> command) throws Exception {
    Process init =
        new ProcessBuilder(command)
            .redirectErrorStream(true)
            .redirectOutput(directory.resolve("init.log").toFile())
            .start();
    if (!init.waitFor(15, TimeUnit.SECONDS)) {
      init.destroyForcibly();
      throw new IOException("Temporary server init timed out");
    }
    if (init.exitValue() != 0)
      throw new IOException("Temporary server init failed: " + directory.resolve("init.log"));
  }

  @Override
  public void close() throws Exception {
    stop();
    // Only the unique directory created by this fixture is removed; no external data paths.
    try (var paths = Files.walk(directory)) {
      for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
    }
  }
}
