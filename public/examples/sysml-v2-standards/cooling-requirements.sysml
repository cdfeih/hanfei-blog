package CoolingRequirements {
    private import ISQ::*;
    private import SI::*;

    part def CoolingUnit {
        attribute responseTime : TimeValue;
    }

    requirement def StartResponse {
        subject unit : CoolingUnit;
        attribute maxResponse : TimeValue;
        assume constraint { maxResponse > 0[s] }
        require constraint {
            unit.responseTime <= maxResponse
        }
    }

    requirement responseLimit : StartResponse {
        attribute :>> maxResponse = 0.12[s];
    }

    part candidate : CoolingUnit {
        attribute :>> responseTime = 0.10[s];
    }

    satisfy responseLimit by candidate;

    // 仅为验证计划骨架：没有实现测量动作，也没有计算 verdict。
    verification def StartResponseEvidence {
        subject unit : CoolingUnit;
        objective {
            verify responseLimit;
        }
    }
}
