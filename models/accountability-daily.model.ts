import { PatientRequestAccountability } from "./patient-request-accountability.model";
import { DailyCost } from "./daily-cost.model";

export interface AccountabilityDaily {
    id: number,
    accountability_id: number,
    daily_cost_id: number,
    amount: number,
    partial?: number,
    accountability: PatientRequestAccountability,
    daily_cost: DailyCost
}
