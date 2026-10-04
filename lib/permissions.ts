export const ROLES=['admin','chef'] as const;
export type Role=typeof ROLES[number];
export const ROLE_LABELS:Record<Role,string>={admin:'Admin',chef:'Chef'};
export const ROLE_DESCRIPTIONS:Record<Role,string>={admin:'Manage all projects, users, inventory, recipes, and menus.',chef:'Create and edit recipes and menus in one assigned project. View inventory and export files.'};
export function canManageUsers(role:Role){return role==='admin';}
export function canWrite(role:Role,kind:string){return role==='admin'||(role==='chef'&&(kind==='recipe'||kind==='menu'));}
