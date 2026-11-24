import {visibleState,type ReportKey,type ViewRole} from '../../../../lib/model';
import {allowedState,context,sessionInfo} from '../../../../lib/access';
import {csv} from '../../../../lib/backup-format';
import {buildReport} from '../../../../lib/reports';

export const dynamic='force-dynamic';
const validReports=new Set<ReportKey>(['pipeline','delivery','workload','followups','waiting']);

export async function GET(req:Request){
 if(!req.headers.get('oai-authenticated-user-id'))return Response.json({error:'Sign in to export reports.'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const c=await context(req);
  const info=sessionInfo(c);
  if(!c.isOwner&&!info.sections.includes('Reports'))return Response.json({error:'Reports access is not enabled for this member.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const url=new URL(req.url);
  const key=(url.searchParams.get('report')||'delivery') as ReportKey;
  if(!validReports.has(key))return Response.json({error:'Unknown report type.'},{status:400,headers:{'Cache-Control':'no-store'}});
  const role=url.searchParams.get('role')||'Owner';
  if(!['Owner','Team','Client','Supplier'].includes(role))return Response.json({error:'Invalid view'},{status:400,headers:{'Cache-Control':'no-store'}});
  const permitted=allowedState(c.state,c.member,c.user.id);
  const state=c.isOwner?visibleState(permitted,role as ViewRole,url.searchParams.get('scope')||''):permitted;
  const financials=c.isOwner?(role==='Owner'):info.financials;
  const report=buildReport(state,key,{
   from:url.searchParams.get('from')||undefined,
   to:url.searchParams.get('to')||undefined,
   companyId:url.searchParams.get('companyId')||undefined,
   brandId:url.searchParams.get('brandId')||undefined,
   projectId:url.searchParams.get('projectId')||undefined,
   owner:url.searchParams.get('owner')||undefined,
   hat:url.searchParams.get('hat')||undefined
  },{financials});
  const exportRows=report.rows.map(r=>{
   const out:Record<string,unknown>={};
   for(const col of report.columns)out[col.label]=r[col.key]??'';
   return out;
  });
  const body=exportRows.length?csv(exportRows):'\uFEFF'+report.columns.map(c=>`"${c.label}"`).join(',')+'\r\n';
  return new Response(body,{
   status:200,
   headers:{
    'Content-Type':'text/csv; charset=utf-8',
    'Content-Disposition':`attachment; filename="dopamine-report-${key}.csv"`,
    'Cache-Control':'no-store'
   }
  });
 }catch(e){
  return Response.json({error:(e as Error).message},{status:403,headers:{'Cache-Control':'no-store'}});
 }
}
