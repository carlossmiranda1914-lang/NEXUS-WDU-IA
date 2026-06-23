// Declarations to support compiling Next.js template files in the Vite sandbox without compiler errors
declare module 'next/headers' {
  export function cookies(): Promise<{
    getAll: () => any[];
    set: (name: string, value: string, options?: any) => void;
  }>;
}

declare module 'next/server' {
  export class NextResponse {
    static next(init?: any): any;
    cookies: {
      set: (name: string, value: string, options?: any) => void;
    };
  }
  export type NextRequest = {
    cookies: {
      getAll: () => any[];
      set: (name: string, value: string) => void;
    };
    headers: any;
  };
}
