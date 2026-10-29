import React from 'react';
import { RoadmapMilestone } from '../../types/audit';
import { CheckCircle2, Circle, Clock, Milestone } from 'lucide-react';

interface UpgradeRoadmapProps {
  roadmap: RoadmapMilestone[];
}

export const UpgradeRoadmap: React.FC<UpgradeRoadmapProps> = ({ roadmap }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <Milestone className="w-4 h-4 text-cyan-400" />
            <span>Autonomous Evolution Roadmap</span>
          </h3>
          <p className="text-xs text-[#A7B4C8]">
            Forward-looking product iterations derived from continuous educational website research and student learning patterns.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roadmap.map(milestone => {
          const completedCount = milestone.items.filter(i => i.done).length;
          const totalCount = milestone.items.length;
          const percent = Math.round((completedCount / totalCount) * 100);

          return (
            <div
              key={milestone.id}
              className={`bg-[#111622] border rounded-xl p-4 flex flex-col justify-between transition-all ${
                milestone.status === 'in_progress'
                  ? 'border-cyan-500/40 bg-gradient-to-b from-[#111622] to-cyan-950/10'
                  : 'border-white/[0.08]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-cyan-400 font-medium">
                    {milestone.phase}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                      milestone.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : milestone.status === 'in_progress'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : 'bg-white/[0.04] text-[#A7B4C8] border-white/[0.08]'
                    }`}
                  >
                    {milestone.status === 'completed'
                      ? 'Live'
                      : milestone.status === 'in_progress'
                      ? 'Active'
                      : 'Upcoming'}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-white mb-1">{milestone.title}</h4>
                <div className="flex items-center gap-1.5 text-xs text-[#A7B4C8] mb-3 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{milestone.timeframe}</span>
                </div>

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-[11px] text-[#A7B4C8] mb-1 font-mono">
                    <span>Sprint Execution</span>
                    <span>{percent}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        milestone.status === 'completed' ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {milestone.items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      {item.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-white/30 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className={`font-medium ${item.done ? 'text-white' : 'text-[#A7B4C8]'}`}>
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#A7B4C8]/80 leading-snug">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
