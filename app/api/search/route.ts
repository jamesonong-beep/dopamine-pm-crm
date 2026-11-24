import {visibleState,type ViewRole} from '../../../lib/model';
import {allowedState,context,sessionInfo} from '../../../lib/access';
import {searchWorkspace} from '../../../lib/search';

export const dynamic='force-dynamic';

function reply(data:unknown,status=200){
 return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
}

export async function GET(req:Request){
 if(!req.headers.get('oai-authenticated-user-id'))return reply({error:'Sign in to search your workspace.'},401);
 try{
  const c=await context(req);
  const url=new URL(req.url);
  const role=url.searchParams.get('role')||'Owner';
  if(!['Owner','Team','Client','Supplier'].includes(role))return reply({error:'Invalid view'},400);
  const permitted=allowedState(c.state,c.member,c.user.id);
  const state=c.isOwner?visibleState(permitted,role as ViewRole,url.searchParams.get('scope')||''):permitted;
  const info=sessionInfo(c);
  const financials=c.isOwner?(role==='Owner'):info.financials;
  const res=searchWorkspace(state,{
   q:url.searchParams.get('q')||'',
   type:url.searchParams.get('type')||'',
   companyId:url.searchParams.get('companyId')||'',
   brandId:url.searchParams.get('brandId')||'',
   owner:url.searchParams.get('owner')||'',
   limit:Number(url.searchParams.get('limit')||50)
  },{financials});
  return reply(res);
 }catch(e){
  return reply({error:(e as Error).message},403);
 }
}
