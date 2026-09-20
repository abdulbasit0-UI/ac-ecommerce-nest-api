export const PermissionSlug = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_WRITE: 'categories:write',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_REFUND: 'payments:refund',
  UPLOADS_WRITE: 'uploads:write',
} as const;

export type PermissionSlug = (typeof PermissionSlug)[keyof typeof PermissionSlug];

export const ALL_PERMISSIONS = Object.values(PermissionSlug);
