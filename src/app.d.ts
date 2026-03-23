/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Locals {
      db: import('$lib/server/db').DrizzleDB;
      user: import('$lib/types/auth').User | null;
    }
    interface PageData {
      user: import('$lib/types/auth').User | null;
    }
  }
}

export {};
