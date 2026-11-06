import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, type NewUser } from '../db/schema.js';

class UserRepository {
  async findById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async findByPhone(phone: string) {
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    return user ?? null;
  }

  async create(data: NewUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async update(id: string, data: Partial<NewUser>) {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  }
}

export const userRepository = new UserRepository();

/** The signed-in user's own profile */
export function toProfile(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    phone: user.phone,
    /** only set for the admin account */
    username: user.username,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    location: user.location,
    latitude: user.latitude === null ? null : Number(user.latitude),
    longitude: user.longitude === null ? null : Number(user.longitude),
    createdAt: user.createdAt,
  };
}
