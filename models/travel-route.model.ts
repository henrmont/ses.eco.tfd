import { PatientRequestTravel } from "./patient-request-travel.model"

export interface TravelRoute {
    id?: number,
    travel_id?: number,
    origin?: string | null,
    destination?: string | null,
    flight?: string | null,
    airplane?: string | null,
    departure?: string | null,
    arrival?: string | null, 
    class?: string | null,
    scales?: string | null,
    family?: string | null
    distance?: number | null,
    travel?: PatientRequestTravel,
}
