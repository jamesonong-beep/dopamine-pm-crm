export type StudioPinKind='announcement'|'postit'|'image'|'document';
export type StudioNoteColor='butter'|'terracotta'|'sage'|'sky'|'ochre';
export type StudioPin={
 id:string;
 kind:StudioPinKind;
 title:string;
 body:string;
 color?:StudioNoteColor;
 imageUrl?:string;
 linkUrl?:string;
 documentId?:string;
 tag?:string;
 pinned:boolean;
 slot?:number;
 author:string;
 createdAt:string;
};

export const CUBIST_STARTER_ART='data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0B2E3B"/><stop offset="52%" stop-color="#15576B"/><stop offset="100%" stop-color="#D49526"/></linearGradient></defs><rect width="640" height="400" fill="url(#bg)"/><polygon points="0,0 280,0 190,170 0,130" fill="#17453A" opacity="0.9"/><polygon points="280,0 470,0 380,140 190,170" fill="#C4441C" opacity="0.88"/><polygon points="470,0 640,0 640,210 380,140" fill="#E3B13C" opacity="0.92"/><polygon points="0,130 190,170 260,340 0,340" fill="#0F4E62" opacity="0.9"/><polygon points="190,170 380,140 430,330 260,340" fill="#E8DCC3" opacity="0.92"/><polygon points="380,140 640,210 640,340 430,330" fill="#C85322" opacity="0.82"/><circle cx="195" cy="210" r="46" fill="#F2EAD7" stroke="#0B2E3B" stroke-width="5"/><circle cx="435" cy="145" r="32" fill="#FFF7E2" stroke="#9E3314" stroke-width="4"/><rect x="0" y="340" width="640" height="60" fill="#EFE4CC"/><polygon points="60,340 165,340 120,382" fill="#C4441C"/><polygon points="420,340 540,340 480,385" fill="#124756"/></svg>`);

export function defaultStudioPins(today:string):StudioPin[]{
 return [
  {
   id:'pin-welcome-announce',
   kind:'announcement',
   title:'Welcome to the Studio Board',
   body:'Pin team announcements, creative references, pitch decks, and dream goals here. Drag unpinned cards freely onto any open slot on the 3×2 board.',
   tag:'Announcement',
   pinned:true,
   slot:0,
   author:'Maya Santos',
   createdAt:`${today}T00:00:00.000Z`
  },
  {
   id:'pin-dream-mood',
   kind:'image',
   title:'Visual North Star — Bold Studio Energy',
   body:'Rich Prussian teal, sunlit ochre, and vermilion geometry. Keep our client decks and brand work feeling brave, clear, and unmistakably crafted.',
   imageUrl:CUBIST_STARTER_ART,
   tag:'Mood & palette',
   pinned:false,
   slot:1,
   author:'Bea Villanueva',
   createdAt:`${today}T00:05:00.000Z`
  },
  {
   id:'pin-postit-goal',
   kind:'postit',
   title:'Q4 Studio Dream Goal',
   body:'Turn 3 multi-brand retainers into flagship case studies with zero missed follow-ups and faster creative approvals.',
   color:'butter',
   tag:'Dream goal',
   pinned:false,
   slot:2,
   author:'Rico Alvarez',
   createdAt:`${today}T00:10:00.000Z`
  },
  {
   id:'pin-postit-ritual',
   kind:'postit',
   title:'Friday 10-Min Retro Ritual',
   body:'After every signed or closed deal, drop 3 quick bullets in the Journey & Self-Review card so our playbook gets sharper every month.',
   color:'sage',
   tag:'Team habit',
   pinned:false,
   slot:3,
   author:'Carlo Mendoza',
   createdAt:`${today}T00:15:00.000Z`
  }
 ];
}

export function normalizeStudioPinSlots(pins:StudioPin[]):StudioPin[]{
 const used=new Set<number>();
 const nextSlot=()=>{let i=0;while(used.has(i))i++;used.add(i);return i;};
 return pins.map(p=>{
  if(typeof p.slot==='number'&&Number.isInteger(p.slot)&&p.slot>=0&&!used.has(p.slot)){
   used.add(p.slot);
   return p;
  }
  return {...p,slot:nextSlot()};
 });
}

