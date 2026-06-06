export interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  rightSlot?: HTMLElement | null;
  summary?: HTMLElement | null;
}

export function createSection(props: SectionProps): {
  root: HTMLDivElement;
  body: HTMLDivElement;
  setOpen: (open: boolean) => void;
} {
  const root = document.createElement('div');
  root.className = 'fsection';

  const header = document.createElement('div');
  header.className = 'fsection-head';
  header.title = `Click to collapse / expand the ${props.title} section`;

  const chevron = document.createElement('span');
  chevron.className = 'fsection-chevron';
  chevron.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 3.5 L5 6 L7.5 3.5" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const title = document.createElement('span');
  title.className = 'fsection-title';
  title.textContent = props.title;

  const left = document.createElement('div');
  left.className = 'fsection-head-left';
  left.append(chevron, title);
  if (props.summary) left.appendChild(props.summary);

  header.appendChild(left);

  if (props.rightSlot) {
    const right = document.createElement('div');
    right.className = 'fsection-head-right';
    right.appendChild(props.rightSlot);
    header.appendChild(right);
  }

  const body = document.createElement('div');
  body.className = 'fsection-body';

  let open = props.defaultOpen ?? true;

  const setOpen = (next: boolean) => {
    open = next;
    root.dataset.open = String(open);
    body.style.display = open ? '' : 'none';
  };
  setOpen(open);

  header.addEventListener('click', e => {
    if ((e.target as Element).closest('.fsection-head-right')) return;
    setOpen(!open);
  });

  root.append(header, body);
  return { root, body, setOpen };
}
