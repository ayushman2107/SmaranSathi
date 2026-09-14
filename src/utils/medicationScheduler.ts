import { Reminder, MedicationStatus, Alert } from '../types';

/**
 * Parses time string (e.g. "08:30 AM", "8:30 AM", "14:15", "8:00") into minutes from midnight.
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim();
  const ampmMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!ampmMatch) return null;

  let hours = parseInt(ampmMatch[1], 10);
  const minutes = parseInt(ampmMatch[2], 10);
  const ampm = ampmMatch[3]?.toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Calculates current medication status based on scheduled time and current clock.
 * - 'taken': User marked completed
 * - 'due': Current time is within -15 to +30 minutes of scheduled time
 * - 'upcoming': Scheduled time is more than 15 minutes ahead today
 * - 'missed': More than 30 minutes past scheduled time and not taken
 */
export function computeMedicationStatus(
  reminder: Partial<Reminder> | { time?: string; time_str?: string; completed?: boolean; taken_today?: boolean }, 
  now: Date = new Date()
): MedicationStatus {
  if (reminder.completed || ('taken_today' in reminder && reminder.taken_today)) {
    return 'taken';
  }

  const reminderMinutes = parseTimeToMinutes(reminder.time || reminder.time_str);
  if (reminderMinutes === null) {
    return 'due';
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = currentMinutes - reminderMinutes;

  if (diffMinutes < -15) {
    return 'upcoming';
  } else if (diffMinutes >= -15 && diffMinutes <= 30) {
    return 'due';
  } else {
    return 'missed';
  }
}

/**
 * Checks if a medication is eligible for a follow-up reminder (15 to 30 mins past due).
 */
export function isFollowupReminderDue(reminder: Reminder, now: Date = new Date()): boolean {
  if (reminder.completed || reminder.followup_sent) return false;
  const reminderMinutes = parseTimeToMinutes(reminder.time || reminder.time_str);
  if (reminderMinutes === null) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = currentMinutes - reminderMinutes;

  return diffMinutes >= 15 && diffMinutes <= 45;
}

/**
 * Checks if a caregiver should be alerted about a missed medication (>30 mins past due).
 */
export function shouldAlertCaregiverMissed(reminder: Reminder, now: Date = new Date()): boolean {
  if (reminder.completed || reminder.missed_notified) return false;
  if (!reminder.is_caregiver_scheduled && reminder.source !== 'caregiver') return false;

  const reminderMinutes = parseTimeToMinutes(reminder.time || reminder.time_str);
  if (reminderMinutes === null) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = currentMinutes - reminderMinutes;

  return diffMinutes > 30;
}

/**
 * Generates an Alert record when a caregiver-scheduled medication is missed.
 */
export function createMissedMedicationAlert(
  reminder: Reminder,
  patientName: string,
  patientId: string,
  caregiverId?: string
): Alert {
  const medName = reminder.medication_name || reminder.title;
  const timeStr = reminder.time || reminder.time_str || 'Scheduled time';
  const dosage = reminder.dosage ? ` (${reminder.dosage})` : '';

  return {
    id: `alert-missed-${reminder.id}-${Date.now()}`,
    user_id: patientId,
    patient_name: patientName,
    caregiver_id: caregiverId || reminder.caregiver_id,
    type: 'missed_medication',
    severity: 'high',
    message: `⚠️ Medication Missed: ${patientName} has not confirmed taking "${medName}"${dosage} scheduled for ${timeStr}. Caregiver follow-up advised.`,
    timestamp: new Date().toISOString(),
    created_at: new Date().toISOString(),
    resolved: false
  };
}

/**
 * Returns badge styling and human-readable text for medication status.
 */
export function getStatusBadgeConfig(status: MedicationStatus) {
  switch (status) {
    case 'taken':
      return {
        label: 'Taken',
        bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        dot: 'bg-emerald-500',
        textColor: 'text-emerald-700',
        accentBg: 'bg-emerald-50 border-emerald-200'
      };
    case 'due':
      return {
        label: 'Due Now',
        bg: 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse',
        dot: 'bg-amber-500',
        textColor: 'text-amber-700',
        accentBg: 'bg-amber-50/80 border-amber-300'
      };
    case 'missed':
      return {
        label: 'Missed',
        bg: 'bg-red-100 text-red-800 border-red-300',
        dot: 'bg-red-500',
        textColor: 'text-red-700',
        accentBg: 'bg-red-50/80 border-red-200'
      };
    case 'upcoming':
    default:
      return {
        label: 'Upcoming',
        bg: 'bg-blue-100 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        textColor: 'text-blue-700',
        accentBg: 'bg-white border-gray-200'
      };
  }
}
