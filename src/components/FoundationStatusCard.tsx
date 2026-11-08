import React from 'react';
import { Database, KeyRound, Layers } from 'lucide-react';
import type { TableSchemaInfo } from '../types';

interface FoundationStatusCardProps {
  table: TableSchemaInfo;
}

export const FoundationStatusCard: React.FC<FoundationStatusCardProps> = ({ table }) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs transition hover:border-emerald-500/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {table.tableName}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <KeyRound className="h-3 w-3 text-amber-500" />
              <span>PK: {table.primaryKey}</span>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          {table.recordCount} {table.recordCount === 1 ? 'record' : 'records'}
        </span>
      </div>

      <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
        {table.description}
      </p>

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
          <Layers className="h-3 w-3" />
          <span>Indexed Fields ({table.indexes.length})</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {table.indexes.map((idx) => (
            <span
              key={idx}
              className="rounded-md bg-slate-100 dark:bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-300"
            >
              {idx}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
