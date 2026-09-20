import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { Role } from '../../modules/roles/entities/role.entity';
import { Permission } from '../../modules/roles/entities/permission.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Category } from '../../modules/categories/entities/category.entity';
import { Product } from '../../modules/products/entities/product.entity';
import { ALL_PERMISSIONS, PermissionSlug } from '../../common/constants/permissions.constant';
import { RoleName } from '../../common/constants/roles.constant';
import { configuration } from '../../config/configuration';
import * as bcrypt from 'bcrypt';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const config = configuration();

  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);

  const descriptions: Record<string, string> = {
    [PermissionSlug.USERS_READ]: 'View users',
    [PermissionSlug.USERS_WRITE]: 'Create and update users',
    [PermissionSlug.ROLES_READ]: 'View roles',
    [PermissionSlug.ROLES_WRITE]: 'Manage roles and permissions',
    [PermissionSlug.CUSTOMERS_READ]: 'View customers',
    [PermissionSlug.CUSTOMERS_WRITE]: 'Update customers',
    [PermissionSlug.CATEGORIES_READ]: 'View all categories',
    [PermissionSlug.CATEGORIES_WRITE]: 'Manage categories',
    [PermissionSlug.PRODUCTS_READ]: 'View all products',
    [PermissionSlug.PRODUCTS_WRITE]: 'Manage products',
    [PermissionSlug.ORDERS_READ]: 'View all orders',
    [PermissionSlug.ORDERS_WRITE]: 'Update order status',
    [PermissionSlug.PAYMENTS_READ]: 'View payments',
    [PermissionSlug.PAYMENTS_REFUND]: 'Issue Stripe refunds',
    [PermissionSlug.UPLOADS_WRITE]: 'Upload media to S3',
  };

  const permissions: Permission[] = [];
  for (const slug of ALL_PERMISSIONS) {
    let permission = await permissionRepo.findOne({ where: { slug } });
    if (!permission) {
      permission = await permissionRepo.save(
        permissionRepo.create({ slug, description: descriptions[slug] ?? slug }),
      );
    }
    permissions.push(permission);
  }

  const findBySlug = (slugs: PermissionSlug[]) =>
    permissions.filter((permission) => slugs.includes(permission.slug));

  async function upsertRole(name: RoleName, description: string, slugs: PermissionSlug[]) {
    let role = await roleRepo.findOne({ where: { name }, relations: { permissions: true } });
    if (!role) {
      role = roleRepo.create({ name, description, permissions: findBySlug(slugs) });
    } else {
      role.description = description;
      role.permissions = findBySlug(slugs);
    }
    return roleRepo.save(role);
  }

  const superAdmin = await upsertRole(RoleName.SUPER_ADMIN, 'Full access', ALL_PERMISSIONS);
  await upsertRole(RoleName.ADMIN, 'Store administrator', [
    PermissionSlug.USERS_READ,
    PermissionSlug.CUSTOMERS_READ,
    PermissionSlug.CUSTOMERS_WRITE,
    PermissionSlug.CATEGORIES_READ,
    PermissionSlug.CATEGORIES_WRITE,
    PermissionSlug.PRODUCTS_READ,
    PermissionSlug.PRODUCTS_WRITE,
    PermissionSlug.ORDERS_READ,
    PermissionSlug.ORDERS_WRITE,
    PermissionSlug.PAYMENTS_READ,
    PermissionSlug.PAYMENTS_REFUND,
    PermissionSlug.UPLOADS_WRITE,
  ]);
  await upsertRole(RoleName.STAFF, 'Fulfillment staff', [
    PermissionSlug.ORDERS_READ,
    PermissionSlug.ORDERS_WRITE,
    PermissionSlug.PRODUCTS_READ,
    PermissionSlug.CUSTOMERS_READ,
  ]);
  await upsertRole(RoleName.CUSTOMER, 'Store customer', []);

  const adminEmail = config.seedAdminEmail.toLowerCase();
  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash(config.seedAdminPassword, 12),
        firstName: config.seedAdminFirstName,
        lastName: config.seedAdminLastName,
        isEmailVerified: true,
        isActive: true,
        role: superAdmin,
        roleId: superAdmin.id,
      }),
    );
  }

  let audio = await categoryRepo.findOne({ where: { slug: 'audio' } });
  if (!audio) {
    audio = await categoryRepo.save(
      categoryRepo.create({
        name: 'Audio',
        slug: 'audio',
        description: 'Headphones, speakers, and studio gear',
        isActive: true,
        sortOrder: 1,
      }),
    );
  }

  const existingProduct = await productRepo.findOne({ where: { sku: 'HP-1001' } });
  if (!existingProduct) {
    await productRepo.save(
      productRepo.create({
        name: 'Studio Headphones',
        slug: 'studio-headphones',
        sku: 'HP-1001',
        description: 'Closed-back monitoring headphones for mixing and mastering.',
        price: 199.99,
        compareAtPrice: 249.99,
        currency: 'usd',
        categoryId: audio.id,
        stockQuantity: 40,
        isActive: true,
        isFeatured: true,
      }),
    );
  }

  console.log(`Seed complete. Admin login: ${adminEmail}`);
  await app.close();
}

void run();
