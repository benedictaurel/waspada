import Link from "next/link";
import { Icon } from "./icon";

export function Sidebar({ active = "overview" }: { active?: "overview" | "add" }) {
  return <aside className="sidebar">
    <Link href="/" className="brand"><span className="brand-mark"><Icon name="pulse" size={25} /></span><span>waspada<span className="brand-period">.</span><small>DRIVER INTELLIGENCE</small></span></Link>
    <div className="side-label">WORKSPACE</div>
    <nav className="side-nav" aria-label="Main navigation">
      <Link className={"nav-item " + (active === "overview" ? "active" : "")} href="/" aria-current={active === "overview" ? "page" : undefined}><Icon name="grid" />Overview<span className="nav-active-dot" /></Link>
      <Link className={"nav-item " + (active === "add" ? "active" : "")} href="/add-driver" aria-current={active === "add" ? "page" : undefined}><Icon name="plus" />Add driver</Link>
    </nav>
  </aside>;
}
