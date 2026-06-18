document.addEventListener('DOMContentLoaded', async () => {
  // Wire up Logout Button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const logoutRes = await fetch('/api/admin/logout', { method: 'POST' });
        if (logoutRes.ok) {
          window.location.href = '/login.html';
        } else {
          alert('Failed to log out.');
        }
      } catch (err) {
        console.error(err);
        alert('Error logging out.');
      }
    });
  }

  try {
    const res = await fetch('/api/results');
    if (res.status === 401) {
      window.location.href = '/login.html';
      return;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch results: ${res.statusText}`);
    }
    const submissions = await res.json();
    
    if (!submissions || submissions.length === 0) {
      document.getElementById('totalSubmissions').textContent = "0";
      return;
    }

    // Calculate Stats
    document.getElementById('totalSubmissions').textContent = submissions.length;
    
    let totalImages = 0;
    const annotators = new Set();
    const rankSums = { Gemini: 0, OurModel: 0, Llama: 0, MedGemma: 0 };
    const rankCounts = { Gemini: 0, OurModel: 0, Llama: 0, MedGemma: 0 };
    const firstPlaceCounts = { Gemini: 0, OurModel: 0, Llama: 0, MedGemma: 0 };

    submissions.forEach(sub => {
      annotators.add(sub.annotator_id);
      totalImages += sub.data.annotations.length;
      
      sub.data.annotations.forEach(ann => {
        const ranks = ann.rankings;
        for (const [model, rank] of Object.entries(ranks)) {
          if (rankSums[model] !== undefined) {
            rankSums[model] += rank;
            rankCounts[model] += 1;
            if (rank === 1) firstPlaceCounts[model] += 1;
          }
        }
      });
    });

    document.getElementById('totalImages').textContent = totalImages;
    document.getElementById('uniqueAnnotators').textContent = annotators.size;

    // Averages
    const models = ["Gemini", "OurModel", "Llama", "MedGemma"];
    const averages = models.map(m => rankCounts[m] > 0 ? (rankSums[m] / rankCounts[m]).toFixed(2) : 0);
    const winRates = models.map(m => rankCounts[m] > 0 ? ((firstPlaceCounts[m] / rankCounts[m]) * 100).toFixed(1) : 0);

    const colors = [
      'rgba(0, 180, 216, 0.7)',  // Gemini
      'rgba(6, 214, 160, 0.7)',  // OurModel
      'rgba(255, 209, 102, 0.7)', // Llama
      'rgba(239, 71, 111, 0.7)'   // MedGemma
    ];

    // Average Rank Chart
    new Chart(document.getElementById('avgRankChart'), {
      type: 'bar',
      data: {
        labels: models,
        datasets: [{
          label: 'Average Rank (1 is Best)',
          data: averages,
          backgroundColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, max: 4 } }
      }
    });

    // Win Rate Chart
    new Chart(document.getElementById('winRateChart'), {
      type: 'pie',
      data: {
        labels: models,
        datasets: [{
          label: '% of #1 Ranks',
          data: winRates,
          backgroundColor: colors
        }]
      }
    });

    // Table
    const tbody = document.getElementById('recentSubmissionsBody');
    submissions.slice(-10).reverse().forEach(sub => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${sub.annotator_id}</td>
        <td>${new Date(sub.completed_at).toLocaleString()}</td>
        <td>${sub.data.annotations.length}</td>
      `;
      tbody.appendChild(tr);
    });


  } catch (e) {
    console.error("Failed to load dashboard data", e);
  }
});
