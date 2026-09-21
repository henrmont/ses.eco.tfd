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
    status?: boolean,
    patient_request?: PatientRequest,
    cost_assistance_dailies?: CostAssistanceDaily[],
    total_dailies?: number,
    total_amount?: number,
    dailies?: any,
    passenger?: TravelPassenger,
    payment?: Payment
}
