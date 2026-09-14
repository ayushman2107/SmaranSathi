import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  MapPin, 
  Phone, 
  Bell, 
  Radio, 
  Activity, 
  Sparkles,
  Volume2,
  Trash2,
  UserCheck,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { MedicationSchedule, User, Reminder, RegionalLanguage } from '../../types';
import { soundEffects } from '../../utils/soundEffects';
import { computeMedicationStatus, getStatusBadgeConfig } from '../../utils/medicationScheduler';

interface IntegratedCareViewProps {
  user: User;
  caregiverName?: string;
  onAddReminder?: (newRem: Omit<Reminder, 'id' | 'created_at' | 'completed'>) => void;
  isElderlyMode?: boolean;
  language?: RegionalLanguage;
}

export const IntegratedCareView: React.FC<IntegratedCareViewProps> = ({
  user,
  caregiverName,
  onAddReminder,
  isElderlyMode = false,
  language = 'en'
}) => {
  const [medications, setMedications] = useState<MedicationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [isCaregiverMode, setIsCaregiverMode] = useState(true);

  const effectiveCaregiverName =
    caregiverName ||
    user.connected_caregiver_name ||
    user.emergency_contact?.name ||
    'Assigned Caregiver';

  // Form State
  const [medName, setMedName] = useState('');
  const [dosage, setDosage] = useState('5mg (1 Tablet)');
  const [timing, setTiming] = useState<'morning' | 'afternoon' | 'evening' | 'bedtime'>('morning');
  const [timeStr, setTimeStr] = useState('08:30 AM');
  const [purpose, setPurpose] = useState('');

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/medications/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications || []);
      }
    } catch (err) {
      console.error('Error fetching medications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, [user.id]);

  const handleToggleTaken = async (medId: string) => {
    soundEffects.playSuccessChime();
    try {
      const res = await fetch(`/api/medications/${medId}/toggle`, { method: 'PUT' });
      if (res.ok) {
        const data = await res.json();
        setMedications((prev) =>
          prev.map((m) => (m.id === medId ? data.medication : m))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;

    soundEffects.playGentleTap(520);
    try {
      const isCaregiver = isCaregiverMode;
      const res = await fetch('/api/medications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          med_name: medName.trim(),
          dosage: dosage.trim() || '1 Tablet',
          timing,
          time_str: timeStr,
          purpose: purpose.trim() || 'Health Maintenance & Memory Support',
          created_by: isCaregiver ? effectiveCaregiverName : user.name,
          is_caregiver_scheduled: isCaregiver,
          caregiver_id: isCaregiver ? (user.connected_caregiver_id || 'caregiver') : undefined,
          caregiver_name: isCaregiver ? effectiveCaregiverName : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMedications((prev) => [...prev, data.medication]);
        if (onAddReminder && data.reminder) {
          onAddReminder({
            user_id: user.id,
            type: 'medication',
            title: `${medName.trim()} (${dosage.trim() || '1 Tablet'})`,
            time: timeStr,
            recurrence: 'daily',
            instructions: purpose.trim() ? `Purpose: ${purpose.trim()}. Take as prescribed.` : 'Take as prescribed by caregiver.',
            created_by: isCaregiver ? effectiveCaregiverName : user.name,
            priority: 'high',
            audio_chime: true,
            spoken_prompt: `Time for your medicine: ${medName.trim()}, ${dosage.trim() || 'one tablet'} at ${timeStr}.`,
            is_caregiver_scheduled: isCaregiver,
            source: isCaregiver ? 'caregiver' : 'patient',
            caregiver_id: isCaregiver ? (user.connected_caregiver_id || 'caregiver') : undefined,
            caregiver_name: isCaregiver ? effectiveCaregiverName : undefined,
            medication_name: medName.trim(),
            dosage: dosage.trim() || '1 Tablet',
            frequency: `${timing.charAt(0).toUpperCase() + timing.slice(1)} Daily`,
            scheduled_times: [timeStr]
          });
        }
        setIsAddingMed(false);
        setMedName('');
        setPurpose('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMed = async (medId: string) => {
    soundEffects.playGentleTap(350);
    try {
      const res = await fetch(`/api/medications/${medId}`, { method: 'DELETE' });
      if (res.ok) {
        setMedications((prev) => prev.filter((m) => m.id !== medId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const caregiverScheduledMeds = medications.filter(
    (m) => m.is_caregiver_scheduled || m.created_by?.toLowerCase().includes('caregiver') || (m.created_by && m.created_by !== user.name)
  );
  const selfManagedMeds = medications.filter(
    (m) => !caregiverScheduledMeds.some(c => c.id === m.id)
  );

  const takenCount = medications.filter((m) => m.taken_today).length;
  const adherencePct = medications.length > 0 
    ? Math.round((takenCount / medications.length) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Care Header */}
      <div className="bg-gradient-to-r from-teal-800 via-emerald-800 to-cyan-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-teal-700 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-teal-500/20 text-teal-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider border border-teal-400/30 flex items-center gap-1.5 w-fit">
              <Activity className="w-3.5 h-3.5 text-teal-300" />
              Care Module • Integrated Care Services
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Medication Management System (MMS)
            </h2>
            <p className="text-sm text-teal-100 max-w-xl">
              Dosage schedule timeline, caregiver prescription tagging, and instantaneous emergency beacon dispatch for {user.name}.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/20 text-center sm:text-right">
            <span className="text-xs font-bold text-teal-200 uppercase block">Today's Medication Adherence</span>
            <span className="text-3xl font-black text-white">{adherencePct}%</span>
            <span className="text-xs text-teal-200 block mt-0.5">{takenCount} of {medications.length} taken</span>
          </div>
        </div>
      </div>

      {/* Two Core Columns matching the diagram */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Left Column: MEDICATION MANAGEMENT SYSTEM (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-emerald-200 p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-sm">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Medication Schedules & Adherence
                </h3>
                <p className="text-xs text-gray-500">Caregiver-scheduled and self-managed prescriptions</p>
              </div>
            </div>

            <button
              onClick={() => {
                soundEffects.playGentleTap(500);
                setIsAddingMed(!isAddingMed);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Medication</span>
            </button>
          </div>

          {/* Add Medication Drawer Form */}
          {isAddingMed && (
            <form onSubmit={handleAddMedication} className="bg-emerald-50/70 border-2 border-emerald-300 p-4 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-950">Schedule Medication Entry</span>
                <button
                  type="button"
                  onClick={() => setIsAddingMed(false)}
                  className="text-xs text-gray-500 font-bold hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Creator Mode Switch */}
              <div className="flex items-center gap-2 p-1.5 bg-emerald-100/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsCaregiverMode(true)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    isCaregiverMode ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-900 hover:bg-emerald-200'
                  }`}
                >
                  👨‍⚕️ Caregiver Scheduled (MMS Priority)
                </button>
                <button
                  type="button"
                  onClick={() => setIsCaregiverMode(false)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    !isCaregiverMode ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-900 hover:bg-emerald-200'
                  }`}
                >
                  👤 Patient Self-Added
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Donepezil / Memantine"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Dosage / Strength *</label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 5mg (1 Tablet)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Time of Day</label>
                  <select
                    value={timing}
                    onChange={(e: any) => setTiming(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl font-bold cursor-pointer"
                  >
                    <option value="morning">Morning (Post Breakfast)</option>
                    <option value="afternoon">Afternoon (Post Lunch)</option>
                    <option value="evening">Evening (Sunset / Tea)</option>
                    <option value="bedtime">Bedtime (Night)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Scheduled Exact Time</label>
                  <input
                    type="text"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">Clinical Instructions / Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Memory maintenance. Take with lukewarm water after breakfast."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl font-bold"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black shadow cursor-pointer hover:bg-emerald-700"
                >
                  Save & Publish Schedule
                </button>
              </div>
            </form>
          )}

          {/* SECTION 1: CAREGIVER-SCHEDULED MEDICATIONS (DISTINCT SECTION) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-rose-100 text-rose-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-rose-950 uppercase tracking-wider">
                  Scheduled by Caregiver ({caregiverScheduledMeds.length})
                </h4>
              </div>
              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Caregiver Controlled
              </span>
            </div>

            {loading ? (
              <div className="text-center py-6 text-gray-400 font-bold text-xs">
                Loading caregiver schedules...
              </div>
            ) : caregiverScheduledMeds.length === 0 ? (
              <div className="p-4 rounded-2xl bg-rose-50/40 border border-dashed border-rose-200 text-center text-xs text-rose-800 font-bold">
                No caregiver-scheduled medications assigned yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {caregiverScheduledMeds.map((item) => {
                  const status = computeMedicationStatus({
                    time: item.time_str,
                    completed: item.taken_today,
                    type: 'medication'
                  });
                  const badge = getStatusBadgeConfig(status);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.taken_today
                          ? 'bg-emerald-50/60 border-emerald-300'
                          : status === 'missed'
                          ? 'bg-red-50/70 border-red-300 shadow-xs'
                          : status === 'due'
                          ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                          : 'bg-rose-50/30 border-rose-200 hover:border-rose-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-black text-gray-900">{item.med_name}</span>
                          <span className="text-xs font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                            💊 {item.dosage}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 ${badge.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            <span>{badge.label}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-gray-600 font-semibold flex-wrap">
                          <span className="flex items-center gap-1 text-slate-800 font-bold">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            {item.time_str} ({item.timing})
                          </span>
                          <span className="text-gray-500">• {item.purpose}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-teal-800 font-bold pt-0.5">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                          <span>Caregiver: <strong>{item.created_by || effectiveCaregiverName}</strong></span>
                        </div>

                        {item.taken_today && item.last_taken_at && (
                          <span className="text-[10px] text-emerald-700 font-bold block pt-0.5">
                            ✓ Confirmed taken today at {new Date(item.last_taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => handleToggleTaken(item.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                            item.taken_today
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{item.taken_today ? 'Taken' : 'Mark Taken'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteMed(item.id)}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove Schedule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: PATIENT SELF-MANAGED MEDICATIONS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-slate-100 text-slate-700">
                  <Pill className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Self-Managed Medications ({selfManagedMeds.length})
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Self-Reported
              </span>
            </div>

            {selfManagedMeds.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-bold">
                No self-managed medications added.
              </div>
            ) : (
              <div className="space-y-2.5">
                {selfManagedMeds.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      item.taken_today
                        ? 'bg-emerald-50/50 border-emerald-300'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-gray-900">{item.med_name}</span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                          {item.dosage}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {item.time_str} ({item.timing})
                        </span>
                        <span className="text-gray-600">• {item.purpose}</span>
                      </div>

                      {item.taken_today && item.last_taken_at && (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          ✓ Taken today at {new Date(item.last_taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleToggleTaken(item.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          item.taken_today
                            ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                            : 'bg-slate-700 hover:bg-slate-800 text-white shadow-xs'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{item.taken_today ? 'Taken' : 'Mark Taken'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteMed(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove Schedule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: EMERGENCY RESPONSE PROTOCOL (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-red-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-red-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shadow-sm">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Emergency Response Protocol
                </h3>
                <p className="text-xs text-gray-500">Live GPS beacon & Caregiver SOS trigger</p>
              </div>
            </div>

            {/* Simulated Live Location Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-red-600" />
                  Active Regional Beacon
                </span>
                <span className="text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-600" />
                  GPS Tracking
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900">
                {user.location || 'Silpukhuri, Guwahati, Assam'}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Lat: 26.1856° N</span>
                <span>Lng: 91.7539° E</span>
                <span>Accuracy: ±4 meters</span>
              </div>
            </div>

            {/* Emergency Contacts Recipient */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-1.5 text-xs">
              <span className="font-black uppercase text-amber-900 block">Assigned Caregiver Contact:</span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-700" />
                  <span className="font-bold text-gray-900">{effectiveCaregiverName}</span>
                </div>
                <span className="text-amber-800 font-semibold">({user.emergency_contact?.relation || 'Primary Caregiver'})</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>{user.emergency_contact?.phone || '+91 98640 12345'}</span>
              </div>
            </div>

            {/* 24/7 Emergency SOS Monitoring Status */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                </span>
                <span className="uppercase tracking-wider">Patient SOS Sentinel Active</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                Live beacon active for <strong className="font-bold text-emerald-950">{user.name}</strong>. Whenever they trigger emergency SOS from their companion device, you will instantly receive an audible siren alert and full location telemetry.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-red-100 text-[11px] text-gray-500 font-medium flex items-center justify-between">
            <span>Dispatched via SMS & Push Beacon</span>
            <span className="text-emerald-700 font-bold">24/7 Monitored</span>
          </div>
        </div>
      </div>
    </div>
  );
};
