const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Backgrounds
  content = content.replace(/bg-\[\#050505\]/g, 'bg-[var(--color-background)]');
  content = content.replace(/bg-\[\#0c0c0c\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#070707\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#080808\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#090909\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#0a0a0a\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#0b0b0b\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#0d0d0d\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#101010\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#111111\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#111113\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#121212\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#121214\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#131315\]/g, 'bg-[var(--color-surface)]');
  content = content.replace(/bg-\[\#141414\]/g, 'bg-[var(--color-surface)]');
  
  content = content.replace(/bg-zinc-950/g, 'bg-[var(--color-background)]');
  content = content.replace(/bg-zinc-900/g, 'bg-[var(--color-surface)]');
  
  // Specific fix for bg-black but avoiding text-black or border-black
  // We'll just replace 'bg-black ' -> 'bg-[var(--color-surface)] '
  content = content.replace(/bg-black /g, 'bg-[var(--color-surface)] ');
  content = content.replace(/bg-black"/g, 'bg-[var(--color-surface)]"');
  content = content.replace(/bg-black'/g, "bg-[var(--color-surface)]'");
  content = content.replace(/bg-black\//g, "bg-[var(--color-surface)]/"); // e.g. bg-black/50

  // Texts
  content = content.replace(/text-\[\#f4f4f5\]/g, 'text-[var(--color-text)]');
  content = content.replace(/text-zinc-100/g, 'text-[var(--color-text)]');
  content = content.replace(/text-zinc-200/g, 'text-[var(--color-text)]');
  content = content.replace(/text-white/g, 'text-[var(--color-text)]');
  
  // Borders
  content = content.replace(/border-zinc-800/g, 'border-[var(--neon-green-border)]');
  content = content.replace(/border-zinc-900/g, 'border-[var(--neon-green-border)]');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      replaceInFile(filePath);
    }
  });
}

walk('./src');
