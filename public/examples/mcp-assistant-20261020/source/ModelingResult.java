package com.shareetech.mbse.platform.project.mcp.modeling;

import com.shareetech.mbse.platform.mcp.McpOperationReceipt;
import java.util.List;
import java.util.Map;

/** 业务结果与提交、通知状态分别呈现；不把已提交操作重新解释为普通失败。 */
public record ModelingResult(String operationId, String requestId, String status, String semanticStatus,
                             String notificationStatus, boolean undoable, List<String> warnings,
                             Object result) implements McpOperationReceipt {
    @Override
    public boolean toolError() {
        return "FAILED_NO_COMMIT".equals(status) || "UNKNOWN".equals(status)
            || "PARTIAL".equals(semanticStatus) || "PARTIAL_OR_UNKNOWN".equals(semanticStatus);
    }

    @Override
    public Object compactReceipt() {
        return Map.of("operationId", operationId, "requestId", requestId, "status", status,
            "semanticStatus", semanticStatus, "notificationStatus", notificationStatus,
            "undoable", undoable, "resultTruncated", true, "queryTool", "get_model_operation",
            "queryHint", "设置resultOffset=0、resultLimit=128，按nextOffset读取并拼接resultJsonFragment");
    }
}
