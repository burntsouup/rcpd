// Wait for the DOM to fully load
// document.addEventListener('DOMContentLoaded', () => {
//     const resultsSection = document.getElementById('results');

//     // Ensure the results section starts hidden and blank
//     resultsSection.classList.add('hidden');
//     resultsSection.innerHTML = '';

//     // Add event listener to the submit button
//     document.getElementById('submit-diagnosis').addEventListener('click', () => {
//         const answers = [...document.querySelectorAll('input[type="radio"]:checked')];
        
//         // Ensure all questions are answered
//         if (answers.length < 3) {
//             alert('Please answer all questions.');
//             return;
//         }

//         // Calculate the number of "Yes" responses
//         const yesCount = answers.filter(answer => answer.value === 'yes').length;

//         // Populate the results section based on the number of "Yes" answers
//         if (yesCount >= 2) {
//             resultsSection.innerHTML = `
//                 <h2 class="text-2xl font-bold text-gray-800">Your Results</h2>
//                 <p class="text-gray-600 mt-2">
//                     Based on your answers, it’s possible you may have symptoms of RCPD. We recommend visiting the 
//                     <a href="find-a-doctor.html" class="text-green-500 underline">Find a Doctor</a> page to locate a specialist near you.
//                 </p>
//             `;
//         } else {
//             resultsSection.innerHTML = `
//                 <h2 class="text-2xl font-bold text-gray-800">Your Results</h2>
//                 <p class="text-gray-600 mt-2">
//                     Based on your answers, it’s unlikely you have symptoms of RCPD. If you’re still concerned, consider consulting a medical professional.
//                 </p>
//             `;
//         }

//         // Unhide the results section
//         resultsSection.classList.remove('hidden');
//     });
// });



console.log("Script loaded");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");

    // Check if the search button exists. If not, this script isn't needed on this page.
    const searchButton = document.getElementById('search-button');
    if (!searchButton) {
      // Optionally log a message or simply return.
      console.error('Search button not found on this page.');
      return;
    }
  
    console.log("Attaching event listener to search button.");
    // Attach the click event only if the element exists.
    searchButton.addEventListener('click', async () => {
      console.log("Search button clicked.");
      const searchInput = document.getElementById('search')?.value.trim();
      if (!searchInput) {
        alert('Please enter a location to search for doctors.');
        return;
      }
  
      try {
        const response = await fetch(`/api/doctors?search=${encodeURIComponent(searchInput)}`);
        console.log("Fetch response status:", response.status);
        if (!response.ok) {
          throw new Error('Error fetching doctor data');
        }
        
        const doctors = await response.json();
        console.log("Received doctors:", doctors);
        
        // Check that the doctor list element exists
        const doctorListElem = document.getElementById('doctor-list');
        if (!doctorListElem) {
          console.error("Doctor list element not found on this page.");
          return;
        }
        
        // Clear existing content
        doctorListElem.innerHTML = '';
        
        // Populate the list with doctor data
        if (doctors.length === 0) {
          doctorListElem.innerHTML = '<p>No doctors found for this location.</p>';
        } else {
          doctors.forEach((doctor) => {
            const doctorItem = document.createElement('li');
            doctorItem.classList.add('mb-4');
            doctorItem.innerHTML = `
              <h3 class="text-lg font-semibold text-gray-800">${doctor.Name}</h3>
              <p class="text-gray-600">${doctor.Specialty}, ${doctor.City}, ${doctor.State_Province}, ${doctor.Country}</p>
              <p class="text-gray-600">Clinic: ${doctor.Clinic_Name}</p>
              <p class="text-gray-600">Website: <a href="${doctor.Website}" class="text-green-500 underline" target="_blank">${doctor.Website}</a></p>
            `;
            doctorListElem.appendChild(doctorItem);
          });
        }
        
        // Remove the hidden class so that the list becomes visible
        doctorListElem.classList.remove('hidden');
      } catch (error) {
        console.error('Error retrieving doctor data:', error);
        alert('There was an error fetching doctor information. Please try again later.');
      }
    });
  });