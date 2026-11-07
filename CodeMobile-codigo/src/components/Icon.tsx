type IconName =
  | 'menu'
  | 'close'
  | 'plus'
  | 'file'
  | 'file-plus'
  | 'folder'
  | 'folder-open'
  | 'folder-plus'
  | 'search'
  | 'terminal'
  | 'settings'
  | 'palette'
  | 'save'
  | 'chevron-right'
  | 'chevron-down'
  | 'more'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-down'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'info'
  | 'keyboard'
  | 'check'
  | 'sun'
  | 'moon'
  | 'code'
  | 'install'
  | 'sparkle'
  | 'home'
  | 'comment'
  | 'braces'
  | 'refresh'
  | 'sidebar'
  | 'layers';

const PATHS: Record<IconName, string> = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5',
  'file-plus': 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 12v5M9.5 14.5h5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'folder-open': 'M3 9V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1M3 9h18l-2 8a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z',
  'folder-plus': 'M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v6M9 14h6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  terminal: 'M4 5h16v14H4zM7.5 10l2.5 2-2.5 2M12.5 14.5h4',
  settings:
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1',
  palette:
    'M12 3a9 9 0 1 0 0 18c1.7 0 2.2-1 1.6-2.2-.5-1.1.3-2.1 1.6-2.1h1.6A3.2 3.2 0 0 0 20 13.5C20 7.7 16.4 3 12 3zM7.5 10.5h.01M10 7.5h.01M14 7.5h.01M16.5 10.5h.01',
  save: 'M5 3h11l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  more: 'M12 6.5h.01M12 12h.01M12 17.5h.01',
  'arrow-left': 'M14 6l-6 6 6 6',
  'arrow-right': 'M10 6l6 6-6 6',
  'arrow-up': 'M6 14l6-6 6 6',
  'arrow-down': 'M6 10l6 6 6-6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  edit: 'M4 20h4L18 10l-4-4L4 16zM14 6l4 4',
  copy: 'M8 8h11v12H8zM5 16H3V4h12v1',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  check: 'M5 12l5 5L20 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  code: 'M9 18l-6-6 6-6M15 6l6 6-6 6',
  install: 'M12 4v10M8 11l4 4 4-4M4 19h16',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  comment: 'M20 4H4v12h4v4l4-4h8z',
  braces: 'M9 4c-2 0-2 2-2 4s-1 3-3 3c2 0 3 1 3 3s0 4 2 4M15 4c2 0 2 2 2 4s1 3 3 3c-2 0-3 1-3 3s0 4-2 4',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 5v6h-6',
  sidebar: 'M4 4h16v16H4zM10 4v16M14 9l-2 3 2 3',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
};

export type { IconName };

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
