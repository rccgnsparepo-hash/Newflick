import React, { useState } from 'react';
import { GraduationCap, Users, Bell, ChevronDown, Check, Building, BookOpen, MessageSquare } from 'lucide-react';
import { CampusOption } from '../../types/news';
import { playGlitchClickSound } from '../../lib/sounds';

interface CampusNewsHubProps {
  selectedCampus: string;
  onSelectCampus: (campusId: string) => void;
  followedCampuses: Set<string>;
  onToggleFollowCampus: (campusId: string) => void;
}

export const NIGERIAN_UNIVERSITIES: CampusOption[] = [
  { id: 'all', name: 'All Universities', shortName: 'All Campuses', state: 'National', type: 'Federal' },
  { id: 'unilag', name: 'University of Lagos (Akoka)', shortName: 'UNILAG', state: 'Lagos', type: 'Federal' },
  { id: 'oau', name: 'Obafemi Awolowo University (Ile-Ife)', shortName: 'OAU', state: 'Osun', type: 'Federal' },
  { id: 'ui', name: 'University of Ibadan', shortName: 'UI', state: 'Oyo', type: 'Federal' },
  { id: 'uniben', name: 'University of Benin', shortName: 'UNIBEN', state: 'Edo', type: 'Federal' },
  { id: 'lasu', name: 'Lagos State University (Ojo)', shortName: 'LASU', state: 'Lagos', type: 'State' },
  { id: 'covenant', name: 'Covenant University (Ota)', shortName: 'Covenant', state: 'Ogun', type: 'Private' },
  { id: 'futa', name: 'Federal University of Technology Akure', shortName: 'FUTA', state: 'Ondo', type: 'Federal' },
  { id: 'abu', name: 'Ahmadu Bello University (Zaria)', shortName: 'ABU Zaria', state: 'Kaduna', type: 'Federal' },
  { id: 'unn', name: 'University of Nigeria Nsukka', shortName: 'UNN', state: 'Enugu', type: 'Federal' },
  { id: 'babcock', name: 'Babcock University (Ilishan)', shortName: 'Babcock', state: 'Ogun', type: 'Private' }
];

export const CampusNewsHub: React.FC<CampusNewsHubProps> = ({
  selectedCampus,
  onSelectCampus,
  followedCampuses,
  onToggleFollowCampus
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const activeOption = NIGERIAN_UNIVERSITIES.find(u => u.id === selectedCampus) || NIGERIAN_UNIVERSITIES[0];
  const isFollowed = selectedCampus !== 'all' && followedCampuses.has(selectedCampus);

  return (
    <div className="w-full bg-blue-950/30 border border-blue-800/40 p-3 sm:p-4 mb-4 font-mono select-none">
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-900/60 border border-blue-500/40 text-blue-300">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>CAMPUS DISPATCH</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-blue-900 text-blue-200 border border-blue-700">
                {activeOption.shortName}
              </span>
            </h2>
            <p className="text-[10px] text-blue-300/80">
              Verified campus announcements, academic alerts, research & student discussions
            </p>
          </div>
        </div>

        {/* Campus Follow Action */}
        {selectedCampus !== 'all' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playGlitchClickSound();
              onToggleFollowCampus(selectedCampus);
            }}
            className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition cursor-pointer shrink-0 ${
              isFollowed
                ? 'bg-blue-900/80 text-blue-200 border-blue-500'
                : 'bg-blue-600 hover:bg-blue-500 text-black border-blue-400 font-extrabold'
            }`}
          >
            {isFollowed ? 'Following Campus' : `+ Follow ${activeOption.shortName}`}
          </button>
        )}
      </div>

      {/* Campus Selector Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
        {NIGERIAN_UNIVERSITIES.map((uni) => {
          const isSelected = selectedCampus === uni.id;
          return (
            <button
              key={uni.id}
              onClick={() => {
                playGlitchClickSound();
                onSelectCampus(uni.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono whitespace-nowrap border transition cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-blue-500 text-black font-extrabold border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.35)]'
                  : 'bg-zinc-900/90 text-zinc-300 hover:text-white border-zinc-800 hover:border-blue-700'
              }`}
            >
              <Building className="w-3 h-3" />
              <span>{uni.shortName}</span>
              {uni.state !== 'National' && (
                <span className={`text-[8px] px-1 font-bold ${isSelected ? 'bg-black text-blue-300' : 'bg-zinc-800 text-zinc-400'}`}>
                  {uni.state}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
