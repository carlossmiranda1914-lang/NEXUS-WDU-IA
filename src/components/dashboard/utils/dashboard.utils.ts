import { Student } from '../../../types';
import { KPIMetrics } from '../types/dashboard.types';

export function calculateKPIs(students: Student[]): KPIMetrics {
  const totalStudents = students.length;
  
  const averageGradeVal = totalStudents > 0 
    ? students.reduce((acc, s) => acc + s.averageGrade, 0) / totalStudents 
    : 0;
  const averageGrade = averageGradeVal.toFixed(2);
  
  const averageAttendance = totalStudents > 0 
    ? Math.round(students.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudents) 
    : 100;

  return {
    totalStudents,
    averageGrade,
    averageAttendance,
  };
}
