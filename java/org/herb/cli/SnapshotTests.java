package org.herb.cli;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.TestInfo;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class SnapshotTests {
  private static final Path SNAPSHOTS_DIR = Path.of("snapshots");

  private TestInfo testInfo;

  @BeforeAll
  public static void ensureCliIsExecutable() throws Exception {
    Path binary = Path.of("bin", "herb-java");

    if (Files.exists(binary) && !Files.isExecutable(binary)) {
      binary.toFile().setExecutable(true);
    }
  }

  @BeforeEach
  public void setUp(TestInfo testInfo) {
    this.testInfo = testInfo;
  }

  private String runCLI(String... args) throws Exception {
    String[] command = new String[args.length + 1];
    command[0] = "./bin/herb-java";
    System.arraycopy(args, 0, command, 1, args.length);

    ProcessBuilder processBuilder = new ProcessBuilder(command);
    processBuilder.directory(new File("."));
    processBuilder.redirectErrorStream(true);

    Process process = processBuilder.start();

    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

    try (InputStream inputStream = process.getInputStream()) {
      int bytesRead;
      byte[] readBuffer = new byte[4096];

      while ((bytesRead = inputStream.read(readBuffer)) != -1) {
        outputStream.write(readBuffer, 0, bytesRead);
      }
    }

    process.waitFor();

    return outputStream.toString(StandardCharsets.UTF_8);
  }

  private void assertSnapshot(String actual) throws Exception {
    String methodName = testInfo.getTestMethod().map(m -> m.getName()).orElseThrow(() -> new IllegalStateException("No test method available"));
    String className = testInfo.getTestClass().map(c -> underscore(c.getSimpleName())).orElse("unknown");

    Path snapshotFile = SNAPSHOTS_DIR.resolve(className).resolve(methodName + ".txt");

    if (System.getenv("UPDATE_SNAPSHOTS") != null) {
      Files.createDirectories(snapshotFile.getParent());
      Files.writeString(snapshotFile, actual);
      System.out.println("Updated snapshot: " + snapshotFile);

      return;
    }

    assertTrue(Files.exists(snapshotFile), "Snapshot file not found: " + snapshotFile + "\nRun with UPDATE_SNAPSHOTS=true to create it.");

    String expected = Files.readString(snapshotFile);

    assertEquals(expected, actual, "Snapshot mismatch: " + snapshotFile + "\nRun with UPDATE_SNAPSHOTS=true to update.");
  }

  private static String underscore(String string) {
    return string.replaceAll("([a-z])([A-Z])", "$1_$2").toLowerCase();
  }

  @Test
  public void testVersion() throws Exception {
    String output = runCLI("version");
    assertFalse(output.isEmpty(), "Version output should not be empty");
  }

  @Test
  public void testLex() throws Exception {
    assertSnapshot(runCLI("lex", "snapshots/test.html.erb"));
  }

  @Test
  public void testParse() throws Exception {
    assertSnapshot(runCLI("parse", "snapshots/test.html.erb"));
  }

  @Test
  public void testExtractRuby() throws Exception {
    assertSnapshot(runCLI("ruby", "snapshots/test.html.erb"));
  }

  @Test
  public void testExtractHtml() throws Exception {
    assertSnapshot(runCLI("html", "snapshots/test.html.erb"));
  }
}
