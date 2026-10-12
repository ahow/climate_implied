import { type User, type InsertUser, type ProjectionCache, type InsertProjectionCache } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getProjectionCache(cacheKey: string): Promise<ProjectionCache | undefined>;
  setProjectionCache(data: InsertProjectionCache): Promise<ProjectionCache>;
  clearProjectionCaches(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private projectionCaches: Map<string, ProjectionCache>;

  constructor() {
    this.users = new Map();
    this.projectionCaches = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getProjectionCache(cacheKey: string): Promise<ProjectionCache | undefined> {
    return this.projectionCaches.get(cacheKey);
  }

  async setProjectionCache(data: InsertProjectionCache): Promise<ProjectionCache> {
    const id = randomUUID();
    const cache: ProjectionCache = {
      ...data,
      id,
      createdAt: new Date(),
    };
    this.projectionCaches.set(data.cacheKey, cache);
    return cache;
  }

  async clearProjectionCaches(): Promise<void> {
    this.projectionCaches.clear();
  }
}

export const storage = new MemStorage();
