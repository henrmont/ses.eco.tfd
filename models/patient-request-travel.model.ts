import { TravelCompany } from "../enums/travel-company";
import { TravelTransportation } from "../enums/travel-transportation";
import { TravelType } from "../enums/travel-type";
import { PatientRequest } from "./patient-request.model";
import { TravelPassenger } from "./travel-passenger.model";
import { TravelRoute } from "./travel-route.model";

export interface PatientRequestTravel {
    id?: number,
    patient_request_id?: number,
    transportation?: TravelTransportation,
    type?: TravelType | null,
    origin?: string | null,
    destination?: string | null,
    departure_date?: string | null,
    return_date?: string | null,
    description?: string | null,
    os?: string | null,
    locator?: string | null,
    company?: TravelCompany | null,
    patient_request?: PatientRequest,
    passengers?: TravelPassenger[],
    travel_routes?: TravelRoute[],
    total_tariffs?: number,
    total_taxes?: number,
    total?: number,
    status?: boolean
}
