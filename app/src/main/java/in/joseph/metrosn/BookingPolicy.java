package in.joseph.metrosn;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Deliberately accepts only the token URL shape observed in the official bot. */
public final class BookingPolicy {
    private static final Pattern LINK = Pattern.compile("https://prutech\\.org/KMRL/#/manage/ticket/([A-Za-z0-9]{6,64})(?![A-Za-z0-9_/?#&=%.-])");
    public static String extract(String text) {
        if (text == null) return null;
        Matcher m = LINK.matcher(text);
        while (m.find()) {
            if (m.start() > 0 && !Character.isWhitespace(text.charAt(m.start()-1)) && "(<[\"'".indexOf(text.charAt(m.start()-1)) < 0) continue;
            if (!"booked".equalsIgnoreCase(m.group(1))) return m.group();
        }
        return null;
    }
    public static boolean valid(String value) { return value != null && value.equals(extract(value)); }
    private BookingPolicy() {}
}
