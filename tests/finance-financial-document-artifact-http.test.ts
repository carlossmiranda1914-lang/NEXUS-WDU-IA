import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import { registerFinancialDocumentRoutes } from '../src/modules/finance/financial-document-http.ts';

test('F7-05 artifact HTTP requires authenticated Financial Document capabilities', async () => {
  const app=express(); app.use(express.json()); const auth:any=(req:any,_res:any,next:any)=>{if(req.header('Authorization')==='Bearer financial')req.institutionalContext={institutionId:'tenant-a',role:'financial'};if(req.header('Authorization')==='Bearer director')req.institutionalContext={institutionId:'tenant-a',role:'director'};next();}; registerFinancialDocumentRoutes(app,{query:async()=>({rows:[]})} as any,auth); const server=http.createServer(app); server.listen(0,'127.0.0.1'); await once(server,'listening'); const base=`http://127.0.0.1:${(server.address() as any).port}/api/finance/documents/doc-a/artifacts`;
  try { assert.equal((await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401); assert.equal((await fetch(base,{method:'POST',headers:{Authorization:'Bearer director','Content-Type':'application/json'},body:'{}'})).status,403); assert.notEqual((await fetch(base,{headers:{Authorization:'Bearer financial'}})).status,404); } finally {server.close();}
});
