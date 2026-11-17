export async function deliverWorkout({db, user, staff, targetId, plan, history, clientRef, planRef}, {runTransaction, doc, serverTimestamp}) {
      await runTransaction(db, async transaction => {
        const profile = await transaction.get(clientRef);
        if (!profile.exists() || !profile.data().authUid) throw new Error('Choose a client with website access.');
        const latestId = profile.data().lastPlanId;
        const latest = latestId ? await transaction.get(doc(clientRef, 'workoutPlans', latestId)) : null;
        const version = Math.max(Number(latest?.data()?.version) || 0, ...history.docs.map(item => Number(item.data().version) || 0)) + 1;
        const toArchive = new Set(history.docs.filter(item => item.data().status === 'delivered' && !item.data().archived).map(item => item.id));
        if (latest?.exists()) toArchive.add(latest.id);
        for (const id of toArchive) transaction.update(doc(clientRef, 'workoutPlans', id), {archived:true, archivedAt:serverTimestamp(), archivedBy:user.uid});
        transaction.set(planRef, {...plan, version, status:'delivered', archived:false, clientId:targetId,
          clientName:profile.data().name || 'Client', createdBy:user.uid, createdByName:staff.name || user.email,
          createdAt:serverTimestamp(), source:'training-app'});
        const due = new Date(); due.setMonth(due.getMonth() + 1);
        transaction.update(clientRef, {lastPlanId:planRef.id, lastPlanName:plan.name,
          lastPlanDeliveredAt:serverTimestamp(), updatedAt:serverTimestamp(), planDueDate:new Intl.DateTimeFormat('en-CA').format(due)});
      });

}
