import com.shareetech.mbse.platform.core.util.LogSanitizer;
import java.nio.charset.StandardCharsets;

public class LogSanitizerLab {
    private static void equal(String name, Object expected, Object actual) {
        if (!expected.equals(actual)) throw new AssertionError(name + ": " + actual);
        System.out.println(name + ": " + actual);
    }
    public static void main(String[] args) {
        equal("url/valid", "https://example.test/path", LogSanitizer.withoutQuery(
            "https://alice:synthetic@example.test/path?token=synthetic#fragment"));
        equal("url/malformed", "https://alice:synthetic@example.test/a b", LogSanitizer.withoutQuery(
            "https://alice:synthetic@example.test/a b?token=synthetic"));
        equal("mask/short", "***", LogSanitizer.mask("abcdef"));
        equal("mask/long", "abc***fgh", LogSanitizer.mask("abcdefgh"));
        equal("fingerprint/abc", "ba7816bf8f01", LogSanitizer.fingerprint("abc"));
        String payload = "A\uD83D\uDE00";
        equal("payload/utf16-units", 3, payload.length());
        equal("payload/utf8-bytes", 5, payload.getBytes(StandardCharsets.UTF_8).length);
        if (!LogSanitizer.payloadSummary(payload).startsWith("type=String,length=3,fingerprint="))
            throw new AssertionError("Unexpected summary");
        equal("control/crlf-tab", "a___b", LogSanitizer.stripControlCharacters("a\r\n\tb"));
        equal("control/unicode-retained", true, LogSanitizer.stripControlCharacters("a\u2028b").contains("\u2028"));
        System.out.println("PASS: 10 assertions against the unchanged production class");
    }
}
