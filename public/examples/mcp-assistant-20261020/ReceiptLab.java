import com.shareetech.mbse.platform.project.mcp.modeling.ModelingResult;
import java.util.List;
import java.util.Map;

public class ReceiptLab {
    static int checks;
    static void check(boolean condition) {
        if (!condition) throw new AssertionError("check " + (checks + 1));
        checks++;
    }
    static ModelingResult result(String status, String semantic) {
        return new ModelingResult("op-demo", "req-demo", status, semantic,
            "REFRESH_REQUIRED", false, List.of(), Map.of("dataId", "123"));
    }
    public static void main(String[] args) {
        check(!result("SUCCEEDED", "APPLIED").toolError());
        check(!result("APPLIED_WITH_WARNINGS", "APPLIED_WITH_WARNINGS").toolError());
        check(result("FAILED_NO_COMMIT", "NOT_APPLIED").toolError());
        check(result("UNKNOWN", "UNKNOWN").toolError());
        check(result("APPLIED_WITH_WARNINGS", "PARTIAL").toolError());
        check(result("APPLIED_WITH_WARNINGS", "PARTIAL_OR_UNKNOWN").toolError());
        var compact = (Map<?, ?>) result("UNKNOWN", "UNKNOWN").compactReceipt();
        check("op-demo".equals(compact.get("operationId"))
            && "req-demo".equals(compact.get("requestId"))
            && "UNKNOWN".equals(compact.get("status")));
        check(Boolean.TRUE.equals(compact.get("resultTruncated"))
            && "get_model_operation".equals(compact.get("queryTool")));
        System.out.println("receipt checks: " + checks);
    }
}
