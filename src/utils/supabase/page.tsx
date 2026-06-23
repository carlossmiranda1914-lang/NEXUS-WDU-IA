import React from 'react';
import { createClient } from './server';
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos } = await supabase.from('todos').select();

  return (
    <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4 max-w-md mx-auto my-8">
      <h3 className="text-sm font-bold text-zinc-100 font-mono">Supabase Server-Side Todo Checklist:</h3>
      <ul className="space-y-2">
        {todos?.map((todo: any) => (
          <li key={todo.id} className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-850">
            {todo.name}
          </li>
        ))}
        {(!todos || todos.length === 0) && (
          <li className="text-xs font-mono text-zinc-500 italic">No tasks found or connection in standby.</li>
        )}
      </ul>
    </div>
  );
}
