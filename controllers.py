"""
This file defines actions, i.e. functions the URLs are mapped into
The @action(path) decorator exposed the function at URL:

    http://127.0.0.1:8000/{app_name}/{path}

If app_name == '_default' then simply

    http://127.0.0.1:8000/{path}

If path == 'index' it can be omitted:

    http://127.0.0.1:8000/

The path follows the bottlepy syntax.

@action.uses('generic.html')  indicates that the action uses the generic.html template
@action.uses(session)         indicates that the action uses the session
@action.uses(db)              indicates that the action uses the db
@action.uses(T)               indicates that the action uses the i18n & pluralization
@action.uses(auth.user)       indicates that the action requires a logged in user
@action.uses(auth)            indicates that the action requires the auth object

session, db, T, auth, and tempates are examples of Fixtures.
Warning: Fixtures MUST be declared with @action.uses({fixtures}) else your app will result in undefined behavior
"""

from py4web import action, request, abort, redirect, URL, Field 
from yatl.helpers import A
from .common import db, session, T, cache, auth, logger, authenticated, unauthenticated, flash
from py4web.utils.url_signer import URLSigner
from py4web.utils.form import Form, FormStyleBulma
from pydal.validators import*
from .models import get_user_email
import json


url_signer = URLSigner(session)

# Return a db query that includes only the given partial name or species
def species_search_filter(nameSearch, nameList):
    if nameList:
        return db.sighting.common_name.belongs(nameList.split(","))
    elif nameSearch:
        return db.sighting.common_name.contains(nameSearch, case_sensitive=False)
    else:
        return True


# Parse [min_lon, min_lat, max_lon, max_lat] from a string
def parse_bounds(bounds):
    try:
        l = [float(x) for x in bounds.split(",")]
        return l if len(l) == 4 else None
    except:
        return None


@action("default")
@action.uses(db, auth)
def default():
    return redirect(URL("index"))


@action("index")
@action.uses("index.html", db, auth, url_signer)
def index():
    names = [row.name for row in db(db.species).select(db.species.name, orderby=db.species.name)]
    return dict(speciesList=json.dumps(names))


@action("checklist", method=["GET", "POST"])
@action.uses("checklist.html", db, auth, url_signer)
def checklist():
    if request.method == "POST":
        # Get form data from the checklist submission
        lat = request.json.get("lat")
        lng = request.json.get("lng")
        bird_counts = request.json.get("birdCounts")

        # Save checklist data to the database
        checklist_data = {
            'observer_id': auth.current_user.get("id"),  # Ensure we use the current logged-in user
            'latitude': lat,
            'longitude': lng,
            'sightings': json.dumps(bird_counts),  # Save bird counts as JSON
        }
        db.checklist.insert(**checklist_data)

        # Redirect to My Checklists page
        return redirect(URL("my_checklists"))

    # Pass species list to the checklist page
    species_list = [species.name for species in db().select(db.species.name)]
    return dict(speciesList=json.dumps(species_list))


@action("my_checklists", method=["GET", "POST"])
@action.uses("my_checklist.html", db, auth, url_signer)
def my_checklists():
    # Fetch checklists for the current user
    user_id = auth.current_user.get("id")
    checklists = db(db.checklist.user_id == user_id).select()

    # Format checklist data if needed, for example, parsing the sightings field
    formatted_checklists = []
    for checklist in checklists:
        sightings = json.loads(checklist.sightings)
        formatted_checklists.append({
            "id": checklist.id,
            "sightings": sightings,
            "date": checklist.date,
            "location": (checklist.latitude, checklist.longitude),
        })

    return dict(checklists=json.dumps(formatted_checklists))


@action("delete_checklist", method=["DELETE"])
@action.uses(db, auth, url_signer)
def delete_checklist():
    checklist_id = request.json.get("id")
    db(db.checklist.id == checklist_id).delete()
    return dict(status="success")


@action("checklist/<checklist_id>", method=["GET"])
@action.uses(db, url_signer)
def get_checklist(checklist_id):
    checklist = db(db.checklist.id == checklist_id).select().first()
    if checklist:
        checklist_data = json.loads(checklist.sightings)
        return dict(checklist=checklist, sightings=checklist_data)
    return dict(error="Checklist not found")






'''
@action('checklist', method=['GET', 'POST'])
@action.uses('checklist.html', db, auth, session, url_signer)
def checklist():
    
    #Checklist page where users can log bird sightings. The page requires the user to be logged in.
    user_email = get_user_email()
    if not user_email:
        redirect(URL('index'))  # Redirect to index if not logged in

    # Fetch all species from the database for the dropdown/search bar
    species = db(db.species.id > 0).select().as_list()

    #Generating signer URL for callback
    my_callback_url = URL("submit_checklist", signer=url_signer)

    # Render the checklist template with the species data
    return dict(species=species, my_callback_url=my_callback_url)

@action('my_checklists', method=['GET', 'POST'])
@action.uses('my_checklist.html', db, auth, session, url_signer)
def my_checklists():
    
    #Page to view, edit, and delete checklists submitted by the user.
    user_email = get_user_email()
    if not user_email:
        redirect(URL('index'))  # Redirect to index if not logged in

    # Query to fetch user checklists
    query = db.checklist.observer_id == auth.current_user.get('id')

    # Use py4web's Grid for managing checklists
    grid = Grid(query, db=db, create=False, editable=True, deletable=True, details=False, user_signature=False)

    return dict(grid=grid)

@action('submit_checklist', method='POST')
@action.uses(db, auth, session)
def submit_checklist():
    
    #API endpoint to save a checklist via AJAX.
    user_email = get_user_email()
    if not user_email:
        abort(403)

    data = request.json
    if not data:
        abort(400)

    # Create a new checklist entry
    event_id = db.checklist.insert(
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        date=data.get('date'),
        observer_id=auth.current_user.get('id'),
        duration_minutes=data.get('duration_minutes')
    )

    # Insert sightings associated with the checklist
    sightings = data.get('sightings', [])
    for sighting in sightings:
        db.sighting.insert(
            event_id=event_id,
            common_name=sighting['common_name'],
            count=sighting['count']
        )

    return dict(status='success')

'''

