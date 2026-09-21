import { Permission } from "./permission.model";

export interface Role {
    id?: number;
    name?: string;
    permissions?: Permission[];
}
