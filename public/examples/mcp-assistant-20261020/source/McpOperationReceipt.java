package com.shareetech.mbse.platform.mcp;

/** 写工具的大结果被截断时，必须保留能恢复查询的回执。 */
public interface McpOperationReceipt {
    /** 失败回执仍须保留恢复标识，但协议层必须标记为工具错误。 */
    default boolean toolError() {
        return false;
    }

    /** 返回包含operationId的有界回执。 */
    Object compactReceipt();
}
