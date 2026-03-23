export const countWorkDays = ( endDate: string): number => {
  // 1. Force the time to midnight to avoid time-zone calculation bugs
  
  //the start date is the date the today
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate + "T00:00:00");
  
  let count = 0;
  let currentDate = new Date(start);

  // 2. Loop through every single day from start to end
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    
    // 3. getDay() returns 0 for Sunday and 6 for Saturday.
    // If it is NOT 0 and NOT 6, it's a workday!
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    
    // 4. Move to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
};