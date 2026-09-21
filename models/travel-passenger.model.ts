import { PassengerType } from "../enums/passenger-type";
import { TravelGender } from "../enums/travel-gender";
import { PatientEscort } from "./patient-escort.model";
import { PatientRequestTravel } from "./patient-request-travel.model";
import { Patient } from "./patient.model";

export interface TravelPassenger {
    id?: number,
    travel_id?: number,
    is_patient?: boolean,
    patient_id?: number | null,
    escort_id?: number | null,
    tariff?: number | null,
    tax?: number | null,
    type?: PassengerType | null,
    gender?: TravelGender | null,
    seat?: string | null,
    ticket?: string | null,
    discount?: number,
    travel?: PatientRequestTravel,
    patient?: Patient,
    escort?: PatientEscort,
}
