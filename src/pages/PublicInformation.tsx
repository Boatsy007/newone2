import { useEffect } from 'react'
import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'

type PageConfig = {
  title: string
  eyebrow: string
  description: string
  updated: string
  sections: Array<{ heading: string; body: string[] }>
}

const pages: Record<string, PageConfig> = {
  '/privacy': {
    title: 'Privacy Policy', eyebrow: 'Your information', updated: '19 July 2026',
    description: 'How PlayFooty handles account, supporter, submission and analytics information.',
    sections: [
      { heading: 'Information we collect', body: ['PlayFooty may collect information you submit directly, such as contact details, club claims, highlight submissions, notification preferences and support requests.', 'We may also record limited technical information needed to operate and protect the service, including anonymous search terms, request timing, browser errors and security logs.'] },
      { heading: 'How information is used', body: ['Information is used to provide PlayFooty features, moderate submissions, respond to support requests, improve search and reliability, prevent abuse and communicate requested notifications.', 'PlayFooty does not require private registration data from PlayHQ to display public community-football information.'] },
      { heading: 'Sharing and retention', body: ['Personal information is not sold. Information may be handled by infrastructure providers used to host, secure and operate PlayFooty, subject to their service terms.', 'Information is retained only for as long as it is reasonably needed for the purpose it was collected, legal obligations, dispute handling or platform security.'] },
      { heading: 'Your choices', body: ['You can change notification preferences within PlayFooty. You may request access, correction or deletion of personal information by contacting support.', 'Public football statistics may remain available where they form part of an accurate historical sporting record, subject to correction and moderation processes.'] },
    ],
  },
  '/terms': {
    title: 'Terms of Use', eyebrow: 'Using PlayFooty', updated: '19 July 2026',
    description: 'The conditions that apply when accessing or contributing to PlayFooty.',
    sections: [
      { heading: 'Using the service', body: ['You may use PlayFooty for lawful personal, sporting, club and community purposes. You must not interfere with the service, attempt unauthorised access, submit malicious material or misuse another person’s identity.', 'Features and data availability may change as leagues publish, correct or remove source information.'] },
      { heading: 'User submissions', body: ['You must have the right to submit any video, image, text or information you provide. Submissions may be reviewed, edited, rejected, archived or removed where needed for accuracy, safety, rights management or community standards.', 'By submitting content for publication, you grant PlayFooty permission to host, display and share that content for operating and promoting the platform.'] },
      { heading: 'Accuracy and availability', body: ['PlayFooty aims to display accurate community-football information but does not guarantee that every score, statistic, ranking, fixture or article is complete or error-free.', 'The service may be interrupted for maintenance, security, upstream-data changes or technical faults.'] },
      { heading: 'Liability', body: ['To the extent permitted by law, PlayFooty is not liable for indirect loss arising from reliance on community-football information, third-party links, unavailable services or user-submitted material.', 'Nothing in these terms excludes rights that cannot lawfully be excluded under Australian consumer law.'] },
    ],
  },
  '/disclaimer': {
    title: 'Data & Content Disclaimer', eyebrow: 'Know the source', updated: '19 July 2026',
    description: 'Important context for rankings, statistics, fixtures, articles and imported data.',
    sections: [
      { heading: 'Independent platform', body: ['PlayFooty is an independent community-football platform and is not PlayHQ, the AFL or a replacement for an official competition-management system.', 'Registrations, official fixtures, official results and competition administration remain with the relevant leagues, clubs and source platforms.'] },
      { heading: 'Rankings and analysis', body: ['National and league rankings are PlayFooty analysis produced from available football results, ladder information and league-strength inputs. Rankings are editorial and statistical analysis, not an official premiership table or governing-body determination.', 'Explanations and confidence indicators should be read together with the ranking itself.'] },
      { heading: 'Imported information', body: ['Some public information is imported from screenshots, public pages or approved administrative submissions. OCR and source data can contain mistakes, delays or later corrections.', 'Where PlayFooty identifies a conflict, the information may be held for review rather than published.'] },
      { heading: 'Corrections', body: ['Clubs, leagues, players and community members can report an error through the support page. Correction requests are assessed against available source evidence and the historical record.'] },
    ],
  },
  '/community-guidelines': {
    title: 'Community Guidelines', eyebrow: 'Football belongs to everyone', updated: '19 July 2026',
    description: 'Standards for submissions, comments, claims and participation in PlayFooty.',
    sections: [
      { heading: 'Be respectful', body: ['Do not submit harassment, threats, hate speech, discriminatory material, sexual content involving minors, targeted humiliation or content intended to endanger another person.', 'Competition and debate are welcome; personal abuse is not.'] },
      { heading: 'Be accurate', body: ['Do not knowingly submit false scores, identities, statistics, club claims or misleading context. Clearly identify corrections and provide supporting information where possible.', 'Do not impersonate a player, club official, league administrator or PlayFooty representative.'] },
      { heading: 'Respect rights and privacy', body: ['Only upload content you are entitled to share. Consider the privacy and safety of children and other people shown in videos or images.', 'Do not publish private contact information, medical information or other sensitive personal details without a lawful reason and appropriate consent.'] },
      { heading: 'Moderation', body: ['PlayFooty may reject, restrict, archive or remove content and may limit access where these guidelines are breached. Serious safety or legal concerns may be referred to the appropriate authority.'] },
    ],
  },
  '/support': {
    title: 'Support & Corrections', eyebrow: 'We can help', updated: '19 July 2026',
    description: 'Report incorrect football data, account problems, safety concerns or technical faults.',
    sections: [
      { heading: 'Report a data error', body: ['Include the affected club, league, player, match or article, the page address, what appears incorrect and the best available supporting source.', 'For OCR imports, a clear screenshot of the relevant official ladder, result or goal-kicker table helps the review process.'] },
      { heading: 'Technical support', body: ['Include the device and browser you are using, the page address, what you expected to happen and any error message shown.', 'Do not send passwords, admin keys, access tokens or other secrets in a support request.'] },
      { heading: 'Safety and rights concerns', body: ['Clearly mark urgent safety, privacy, copyright or child-safety concerns in the subject line. Provide enough information to locate the content without redistributing sensitive material unnecessarily.'] },
    ],
  },
}

export default function PublicInformation() {
  const { pathname } = useLocation()
  const page = pages[pathname] ?? pages['/support']

  useEffect(() => {
    document.title = `${page.title} | PlayFooty`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]') ?? document.head.appendChild(document.createElement('meta'))
    description.name = 'description'; description.content = page.description
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
    canonical.href = `${window.location.origin}${pathname}`
  }, [page, pathname])

  return <>
    <Nav />
    <main className="info-page">
      <style>{styles}</style>
      <section className="info-hero"><div><span>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p><small>Last updated {page.updated}</small></div></section>
      <div className="info-layout">
        <aside><Link to="/"><ArrowLeft size={17}/>Back to PlayFooty</Link><nav aria-label="Information pages"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/disclaimer">Data disclaimer</Link><Link to="/community-guidelines">Community guidelines</Link><Link to="/support">Support</Link></nav></aside>
        <article>{page.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2>{section.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
          {pathname === '/support' && <a className="support-email" href="mailto:hello@playfooty.com.au?subject=PlayFooty%20support%20request"><Mail size={20}/><span><strong>Email PlayFooty support</strong><small>hello@playfooty.com.au</small></span><ExternalLink size={17}/></a>}
          <div className="info-note"><ShieldCheck size={20}/><p>These pages provide general platform information and are not legal advice.</p></div>
        </article>
      </div>
    </main>
    <Footer />
  </>
}

const styles = `
.info-page{min-height:70vh;background:#f3f6f9;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.info-hero{padding:clamp(48px,9vw,105px) 24px;background:#050505;color:#fff}.info-hero>div,.info-layout{width:min(1120px,100%);margin:auto}.info-hero span{color:#35b6ff;font-size:11px;font-weight:950;letter-spacing:.17em;text-transform:uppercase}.info-hero h1{margin:10px 0 14px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,7.5rem);line-height:.84;text-transform:uppercase}.info-hero p{max-width:720px;margin:0;color:#cad2dc;font-size:18px;line-height:1.55}.info-hero small{display:block;margin-top:18px;color:#84909e;font-weight:800}.info-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:36px;padding:38px 24px 70px}.info-layout aside{align-self:start;position:sticky;top:96px;display:grid;gap:16px}.info-layout aside>a{display:flex;align-items:center;gap:8px;color:#111318;font-weight:900;text-decoration:none}.info-layout aside nav{display:grid;border:1px solid #dce3eb;border-radius:14px;overflow:hidden;background:#fff}.info-layout aside nav a{padding:12px 14px;border-bottom:1px solid #edf1f5;color:#4d5865;text-decoration:none;font-weight:800}.info-layout aside nav a:last-child{border-bottom:0}.info-layout aside nav a:hover{background:#eef8ff;color:#057fbd}.info-layout article{display:grid;gap:16px}.info-layout article>section{padding:24px;border:1px solid #dce3eb;border-radius:17px;background:#fff}.info-layout h2{margin:0 0 12px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:27px;text-transform:uppercase}.info-layout p{margin:9px 0;color:#4e5966;line-height:1.65}.support-email{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:13px;padding:19px;border-radius:15px;background:#35b6ff;color:#050505;text-decoration:none}.support-email strong,.support-email small{display:block}.support-email small{margin-top:3px}.info-note{display:flex;align-items:flex-start;gap:10px;padding:15px;border:1px solid #dce3eb;border-radius:14px;background:#fff}.info-note p{margin:0}@media(max-width:760px){.info-layout{grid-template-columns:1fr;padding:22px 14px 48px}.info-layout aside{position:static}.info-layout aside nav{grid-template-columns:1fr 1fr}.info-layout aside nav a{border-right:1px solid #edf1f5}.info-layout article>section{padding:19px}.info-hero{padding-left:18px;padding-right:18px}}
`
