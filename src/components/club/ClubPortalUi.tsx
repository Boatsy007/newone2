import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function PortalPageHeader({eyebrow,title,description,back,actions}:{eyebrow:string;title:string;description?:string;back?:ReactNode;actions?:ReactNode}){
 return <header className="pfui-page-header"><div>{back}<span className="pfui-eyebrow">{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="pfui-header-actions">{actions}</div>}</header>
}

export function PortalCard({children,className=''}:{children:ReactNode;className?:string}){
 return <section className={`pfui-card ${className}`.trim()}>{children}</section>
}

export function PortalSectionHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){
 return <div className="pfui-section-header"><div>{eyebrow&&<span className="pfui-eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{actions&&<div>{actions}</div>}</div>
}

export function PortalActionCard({icon:Icon,title,description,onClick,badge}:{icon:LucideIcon;title:string;description:string;onClick:()=>void;badge?:string}){
 return <button className="pfui-action-card" onClick={onClick}>{badge&&<span className="pfui-badge">{badge}</span>}<span className="pfui-action-icon"><Icon size={23}/></span><strong>{title}</strong><span>{description}</span></button>
}

export function PortalButton({variant='primary',className='',children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'}){
 return <button {...props} className={`pfui-button ${variant} ${className}`.trim()}>{children}</button>
}

export function PortalAlert({tone,children}:{tone:'error'|'success'|'info';children:ReactNode}){
 return <div className={`pfui-alert ${tone}`} role={tone==='error'?'alert':'status'}>{children}</div>
}

export function PortalEmptyState({icon:Icon,title,description,action}:{icon:LucideIcon;title:string;description:string;action?:ReactNode}){
 return <div className="pfui-empty"><span><Icon size={30}/></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

export const clubPortalUiStyles=`
:root{--pfui-bg:#f3f6f8;--pfui-surface:#fff;--pfui-surface-soft:#f7f9fb;--pfui-text:#101317;--pfui-muted:#667383;--pfui-line:#dce4ea;--pfui-blue:#0783c9;--pfui-blue-soft:#e6f5fe;--pfui-green:#19a866;--pfui-red:#b42318;--pfui-radius-sm:10px;--pfui-radius:16px;--pfui-radius-lg:22px;--pfui-shadow:0 10px 30px rgba(15,23,42,.07);--pfui-shadow-hover:0 16px 38px rgba(15,23,42,.12);--pfui-content:1240px}
.pfui-page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;max-width:var(--pfui-content);margin:0 auto}.pfui-page-header h1,.pfui-section-header h2,.pfui-empty h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.pfui-page-header h1{margin:8px 0 5px;font-size:clamp(3.5rem,7vw,6.4rem);line-height:.86;letter-spacing:-.02em}.pfui-page-header p,.pfui-section-header p,.pfui-empty p{margin:0;color:var(--pfui-muted);line-height:1.5}.pfui-eyebrow{display:block;color:var(--pfui-blue);font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.pfui-header-actions{display:flex;gap:8px;align-items:center}.pfui-card{border:1px solid var(--pfui-line);border-radius:var(--pfui-radius-lg);background:var(--pfui-surface);box-shadow:var(--pfui-shadow);padding:22px}.pfui-section-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.pfui-section-header h2{margin:6px 0 4px;font-size:clamp(2.2rem,4vw,3.4rem);line-height:1}.pfui-action-card{position:relative;display:grid;align-content:start;gap:10px;min-height:158px;padding:18px;border:1px solid var(--pfui-line);border-radius:var(--pfui-radius);background:var(--pfui-surface);color:var(--pfui-text);text-align:left;box-shadow:0 4px 14px rgba(15,23,42,.035);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.pfui-action-card:hover{transform:translateY(-2px);border-color:#b9d9ec;box-shadow:var(--pfui-shadow-hover)}.pfui-action-card:active{transform:translateY(0)}.pfui-action-card strong{font-size:18px}.pfui-action-card>span:last-child{color:var(--pfui-muted);line-height:1.45}.pfui-action-icon{display:grid;width:42px;height:42px;place-items:center;border-radius:13px;background:var(--pfui-blue-soft);color:var(--pfui-blue)}.pfui-badge{position:absolute;right:12px;top:12px;padding:5px 8px;border-radius:999px;background:#edf8f2;color:#137247;font-size:9px;font-weight:950;text-transform:uppercase}.pfui-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:10px 15px;border:0;border-radius:var(--pfui-radius-sm);font-weight:950;text-transform:uppercase;letter-spacing:.02em;transition:transform .14s ease,opacity .14s ease}.pfui-button:active{transform:scale(.98)}.pfui-button:disabled{opacity:.48}.pfui-button.primary{background:#101317;color:#fff}.pfui-button.secondary{background:var(--pfui-blue-soft);color:#076ba5}.pfui-button.ghost{background:transparent;color:var(--pfui-text)}.pfui-button.danger{background:#feeceb;color:var(--pfui-red)}.pfui-alert{max-width:var(--pfui-content);margin:14px auto 0;padding:12px 14px;border:1px solid transparent;border-radius:var(--pfui-radius-sm);font-weight:800}.pfui-alert.error{border-color:#f2c7c3;background:#fff0ef;color:#9b241a}.pfui-alert.success{border-color:#bde5ce;background:#eaf8f0;color:#12653b}.pfui-alert.info{border-color:#c4e1f1;background:#edf8fe;color:#075f91}.pfui-empty{display:grid;justify-items:center;text-align:center;padding:42px 20px;color:var(--pfui-muted)}.pfui-empty>span{display:grid;width:58px;height:58px;place-items:center;border-radius:18px;background:var(--pfui-blue-soft);color:var(--pfui-blue)}.pfui-empty h3{margin:12px 0 4px;color:var(--pfui-text);font-size:30px}.pfui-empty p{max-width:430px}@media(max-width:720px){.pfui-page-header{align-items:flex-start;flex-direction:column;gap:12px}.pfui-page-header h1{font-size:4rem}.pfui-card{padding:16px;border-radius:17px}.pfui-section-header{flex-direction:column}}
`
