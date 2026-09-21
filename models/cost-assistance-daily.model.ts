import { PatientRequestCostAssistance } from "./patient-request-cost-assistance.model";
import { DailyCost } from "./daily-cost.model";

export interface CostAssistanceDaily {
    id: number,
    cost_assistance_id: number,
    daily_cost_id: number,
    amount: number,
    partial?: number,
    cost_assistance: PatientRequestCostAssistance,
    daily_cost: DailyCost
}
