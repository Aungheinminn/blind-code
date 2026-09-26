export function portal(node: HTMLElement, target: string | HTMLElement = "body") {
  const attach = (t: string | HTMLElement) => {
    const parent =
      typeof t === "string" ? document.querySelector<HTMLElement>(t) : t;
    if (parent) parent.appendChild(node);
  };
  attach(target);
  return {
    update(next: string | HTMLElement) {
      attach(next);
    },
    destroy() {
      node.parentNode?.removeChild(node);
    },
  };
}
