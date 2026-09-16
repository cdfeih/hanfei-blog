package com.shareetech.mbse.platform.core.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HexFormat;

/**
 * 日志脱敏辅助方法。日志中只保留排障所需的最小标识，不保留凭据或完整载荷。
 */
public final class LogSanitizer {

    private static final int MASK_VISIBLE_LENGTH = 3;
    private static final int FINGERPRINT_HEX_LENGTH = 12;

    private LogSanitizer() {
    }

    /**
     * 对标识符保留首尾少量字符，其余使用星号替代。
     *
     * @param value 原始标识符
     * @return 脱敏后的标识符
     */
    public static String mask(String value) {
        if (value == null || value.isBlank()) {
            return "<empty>";
        }
        String normalized = value.trim();
        if (normalized.length() <= MASK_VISIBLE_LENGTH * 2) {
            return "***";
        }
        return normalized.substring(0, MASK_VISIBLE_LENGTH)
            + "***"
            + normalized.substring(normalized.length() - MASK_VISIBLE_LENGTH);
    }

    /**
     * 移除 URL 的用户信息、查询参数和片段，并清除控制字符。
     *
     * @param value 原始 URL
     * @return 可安全记录的端点
     */
    public static String withoutQuery(String value) {
        if (value == null) {
            return null;
        }
        try {
            URI uri = new URI(value);
            if (uri.isAbsolute() && uri.getHost() != null) {
                URI sanitized = new URI(uri.getScheme(), null, uri.getHost(), uri.getPort(),
                    uri.getPath(), null, null);
                return stripControlCharacters(sanitized.toString());
            }
        } catch (URISyntaxException e) {
            // 非标准 URI 按字符串方式移除查询参数和片段。
        }
        int queryIndex = value.indexOf('?');
        int fragmentIndex = value.indexOf('#');
        int endIndex = value.length();
        if (queryIndex >= 0) {
            endIndex = Math.min(endIndex, queryIndex);
        }
        if (fragmentIndex >= 0) {
            endIndex = Math.min(endIndex, fragmentIndex);
        }
        return stripControlCharacters(value.substring(0, endIndex));
    }

    /**
     * 生成不可逆的短指纹，用于关联同一敏感值。
     *
     * @param value 原始值
     * @return SHA-256 短指纹
     */
    public static String fingerprint(String value) {
        if (value == null) {
            return "<null>";
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest).substring(0, FINGERPRINT_HEX_LENGTH);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    /**
     * 返回载荷类型、长度和指纹，不输出载荷正文。
     *
     * @param payload 原始载荷
     * @return 安全摘要
     */
    public static String payloadSummary(Object payload) {
        if (payload == null) {
            return "type=null,length=0,fingerprint=<null>";
        }
        String value = String.valueOf(payload);
        return "type=" + payload.getClass().getSimpleName()
            + ",length=" + value.length()
            + ",fingerprint=" + fingerprint(value);
    }

    /**
     * 替换可能造成日志注入的换行与制表符。
     *
     * @param value 原始值
     * @return 单行安全值
     */
    public static String stripControlCharacters(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("[\\r\\n\\t]", "_");
    }
}
