import { CostAssistanceType } from "../enums/cost-assistance-type";
import { CostAssistanceDaily } from "./cost-assistance-daily.model";
import { PatientRequest } from "./patient-request.model";
import { Payment } from "./payment.model";
import { TravelPassenger } from "./travel-passenger.model";

export interface PatientRequestCostAssistance {
    id?: number,
    patient_request_id?: number,
    name?: string,
    type?: CostAssistanceType,
    passenger_id?: number,
    bank?: string,
    agency?: string,
    account?: string,
    created_at?: any,
    status?: boolean,
    patient_request?: PatientRequest,
    cost_assistance_dailies?: CostAssistanceDaily[],
    total_dailies?: number,
    total_amount?: number,
    dailies?: any,
    passenger?: TravelPassenger,
    payment?: Payment
}
