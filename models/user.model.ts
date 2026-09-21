import { Module } from "./module.model";
import { Professional } from "./professional.model";
import { Role } from "./role.model";

export interface User {
    id?: number;
    name?: string;
    email?: string;
    image?: string;
    module_id?: number,
    is_valid?: boolean;
    roles?: Role[];
    module?: Module;
    professional?: Professional;
}
